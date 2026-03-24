import { IntentClassifier } from '../../flows/intents/classifier';
import { FlowEngine } from './flow.engine';
import { supabase } from '../../config/database';
import Parser from '../parser';
import orderService from '../../services/OrderService';
import slotService from '../../services/DeliverySlotService';
import { logger } from '../../utils/logger';
import { SessionRepository } from '../../infrastructure/repositories/SessionRepository';
import { EntityExtractor } from '../nlu/EntityExtractor';
import { OrderInterpreter } from '../nlu/OrderInterpreter';
import { AIExtractor } from '../nlu/AIExtractor';
import { inventoryManager } from '../inventory/InventoryManager';
import { productService } from '../../services/ProductService';

export class ConversationRouter {
    private intentClassifier: IntentClassifier;
    private flowEngine: FlowEngine;
    private sessionRepository: SessionRepository;
    private nluExtractor: EntityExtractor;
    private nluInterpreter: OrderInterpreter;
    private isNluLoading: boolean = false;

    constructor() {
        this.intentClassifier = new IntentClassifier();
        this.flowEngine = new FlowEngine(undefined, orderService, slotService);
        this.sessionRepository = new SessionRepository();
        this.nluExtractor = new EntityExtractor();
        this.nluInterpreter = new OrderInterpreter(this.nluExtractor);
        this.initNlu();
    }

    private async initNlu() {
        if (this.isNluLoading) return;
        this.isNluLoading = true;
        await this.nluExtractor.loadCatalog();
        this.isNluLoading = false;
    }

    private getSessionId(phone: string, context: any): string {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const remoteJid = context.remoteJid || (cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`);
        return remoteJid.endsWith('@g.us') ? `group:${remoteJid}` : `1to1:${cleanPhone}`;
    }

    async processMessage(phone: string, text: string, pushName: string, initialContext: any = {}): Promise<any[]> {
        const cleanText = text.trim().toLowerCase();
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        
        try {
            // --- 0. LOADS SESSION DATA ---
            const sessionId = this.getSessionId(phone, initialContext);
            const session = await this.sessionRepository.getOrCreate(sessionId, cleanPhone, '304c5d15-ffbb-4b2a-a4de-f81aaa938fdf', initialContext);
            const context = { ...session.getAllVariablesForCurrentFlow(), ...initialContext };
            const remoteJid = context.remoteJid || (phone.includes('@') ? phone : `${cleanPhone}@s.whatsapp.net`);
            
            logger.info(`Message routing`, { 
                sessionId, 
                pushName, 
                text: text.substring(0, 50),
                hasLastInquiry: !!context.last_inquiry,
                contextKeys: Object.keys(context)
            });

            // --- 0.5 AI-FIRST ANALYSIS (Priority Interception) ---
            const aiResult = await AIExtractor.analyze(text);
            const aiConfidence = aiResult ? parseFloat(aiResult.confidence) : 0;
            const isOrder = aiResult && aiConfidence >= 0.7 && aiResult.intent === 'order' && aiResult.items.length > 0;

            logger.info(`[Router] AI-First Analysis: Intent=${aiResult?.intent}, Confidence=${aiConfidence.toString()}, IsOrder=${isOrder.toString()}`);

            if (isOrder) {
                logger.info(`[Router] High confidence ORDER detected via AI. Archiving current session to process order.`, { sessionId });
                await this.sessionRepository.archive(sessionId, 'ai_order_interception');
                return await this.handleAIOrder(phone, aiResult, context, pushName, sessionId);
            }

            // --- 1. PRE-CHECK: Handover Status (Human Support) ---
            const { data: convo } = await supabase
                .from('whatsapp_conversations')
                .select('status')
                .eq('phone', cleanPhone)
                .maybeSingle();

            if (convo && convo.status === 'HANDOVER') {
                if (['reset', 'reiniciar', 'resume', 'hola'].includes(cleanText)) {
                    logger.info(`[HANDOVER] Resuming bot`, { phone });
                    await supabase.from('whatsapp_conversations')
                        .update({ status: 'ACTIVE' })
                        .eq('phone', cleanPhone);
                } else {
                    logger.debug(`[HANDOVER] Message ignored (Human active)`, { phone });
                    return []; 
                }
            }

            // --- 2. TOP PRIORITY: Active Cart (pending_suggestion or pending_override) ---
            const { data: activeDraft } = await supabase.from('draft_orders')
                .select('*')
                .eq('phone', cleanPhone)
                .in('status', ['pending_suggestion', 'pending_override'])
                .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (activeDraft) {
                if (activeDraft.status === 'pending_override') {
                    logger.info(`[Router] Active override draft found for ${cleanPhone}, routing to override handler`);
                    const overrideResponse = await this.handleOverrideResponse(phone, cleanText, context, pushName, sessionId);
                    if (overrideResponse) return overrideResponse;
                } else {
                    logger.info(`[Router] Active cart found for ${cleanPhone}, routing to suggestion handler`, { draftId: activeDraft.id });
                    return await this.handleSuggestionResponse(phone, cleanText, activeDraft, context, pushName, sessionId);
                }
            }

            // --- 2.5 QUICK PATH: Active Flow Sessions (Priority for non-orders) ---
            const isWaitingInput = session && session.status === 'waiting_input';
            const globalTriggers = ['menu', 'menú', 'cancelar', 'inicio', 'salir', 'reset', 'reiniciar', 'hola'];
            const isGlobalCommand = globalTriggers.includes(cleanText);

            if (isWaitingInput && !isGlobalCommand && !isOrder) {
                logger.info(`[Router] Session is waiting input. Bypassing AI/NLU to prioritize FlowEngine.`, { sessionId });
                const engineResponse = await this.flowEngine.processMessage(phone, text, { ...context, pushName, remoteJid });
                return this.extractMessages(engineResponse);
            }

            // --- 3. CORE LOGIC: Catalog, NLU and AI ---
            const catalogDataRaw = Parser.parseCatalogCheckout(text) || { items: Parser.parseCatalogOrder(text), metadata: null };
            const catalogItems = catalogDataRaw?.items;
            const metadata = (catalogDataRaw as any)?.metadata || {};

            if (catalogItems && catalogItems.length > 0) {
                return this.handleCatalogOrder(phone, catalogItems, metadata, pushName, context);
            }

            // NLU Priority
            const nluResult = await this.nluInterpreter.interpret(text);
            if (nluResult.confidence > 0.6) {
                if (nluResult.type === 'direct_order' && nluResult.parsedOrder) return await this.handleNluDirectOrder(phone, nluResult, context, sessionId);
                if (nluResult.type === 'product_inquiry') return await this.handleNluProductInquiry(phone, nluResult, context, sessionId);
                if (nluResult.type === 'category_inquiry') return await this.handleNluCategoryInquiry(phone, nluResult, context, sessionId);
            }

            // AI Interceptor (Inquiries/Support)
            const earlyAI = aiResult;
            const isInquiryOrSupport = earlyAI && earlyAI.confidence > 0.7 && (earlyAI.intent === 'inquiry' || earlyAI.intent === 'support');
            const isAiContextualResponse = earlyAI && earlyAI.confidence > 0.8 && 
                                           (earlyAI.intent === 'confirmation' || earlyAI.intent === 'rejection') && 
                                           context.last_inquiry;

            if (isInquiryOrSupport) {
                if (isWaitingInput && earlyAI.intent === 'support') {
                    logger.info(`[AI Interceptor] Deferring 'support' to FlowEngine because session is waiting input`);
                } else {
                    logger.info(`[AI Interceptor] Answering question`, { intent: earlyAI.intent });
                    if (!isWaitingInput) await this.sessionRepository.archive(sessionId, 'ai_inquiry_interception');
                    return await this.handleAIInquiry(phone, earlyAI, text, sessionId);
                }
            }

            if (isAiContextualResponse) {
                logger.info(`[AI Interceptor] Handling ${earlyAI.intent} for last inquiry`, { product: context.last_inquiry.name });
                await this.sessionRepository.archive(sessionId, 'ai_confirmation_interception');
                if (earlyAI.intent === 'confirmation') {
                    const syntheticResult = {
                        intent: 'order' as const,
                        items: [{
                            name: context.last_inquiry.name,
                            quantity: 1,
                            resolvedProduct: { id: context.last_inquiry.productId, name: context.last_inquiry.name, price: context.last_inquiry.price },
                            matchConfidence: 1
                        }],
                        confidence: 1,
                        reasoning: `Intercepted confirmation`
                    };
                    await this.sessionRepository.updateContext(sessionId, { last_inquiry: null });
                    return await this.handleAIOrder(phone, syntheticResult, context, pushName, sessionId);
                } else {
                    await this.sessionRepository.updateContext(sessionId, { last_inquiry: null });
                    return ['¡Entendido! No hay problema. 😊 ¿En qué otra cosa puedo ayudarte?'];
                }
            }

            // --- 4. FALLBACKS ---
            if (nluResult.confidence > 0.3) {
                if (nluResult.type === 'direct_order') return await this.handleNluDirectOrder(phone, nluResult, context, sessionId);
                if (nluResult.type === 'product_inquiry') return await this.handleNluProductInquiry(phone, nluResult, context, sessionId);
                if (nluResult.type === 'category_inquiry') return await this.handleNluCategoryInquiry(phone, nluResult, context, sessionId);
            }

            // aiResult already available
            if (aiResult && aiResult.confidence > 0.6) {
                logger.info(`[AI Router] AI understood message`, { intent: aiResult.intent });
                
                if (aiResult.intent === 'order' && aiResult.items.length > 0) {
                    await this.sessionRepository.archive(sessionId, 'ai_order_fallback');
                    return await this.handleAIOrder(phone, aiResult, context, pushName, sessionId);
                }
                
                if (aiResult.intent === 'menu_request') {
                    await this.sessionRepository.archive(sessionId, 'ai_menu_request');
                    const engineResponse = await this.flowEngine.processMessage(phone, 'menu', { ...context, pushName, remoteJid });
                    return this.extractMessages(engineResponse);
                }

                if (aiResult.intent === 'greeting') {
                    const engineResponse = await this.flowEngine.processMessage(phone, text, { ...context, pushName, remoteJid });
                    return this.extractMessages(engineResponse);
                }

                if (['confirmation', 'rejection'].includes(aiResult.intent) && context.last_inquiry) {
                    await this.sessionRepository.updateContext(sessionId, { last_inquiry: null });
                    if (aiResult.intent === 'confirmation') {
                         return await this.handleAIOrder(phone, { intent: 'order' as any, items: [{ name: context.last_inquiry.name, quantity: 1, resolvedProduct: { id: context.last_inquiry.productId, name: context.last_inquiry.name, price: context.last_inquiry.price }, matchConfidence: 1 }], confidence: 1, reasoning: 'Confirmado' }, context, pushName, sessionId);
                    }
                    return ['¡Entendido! No hay problema. 😊 ¿En qué otra cosa puedo ayudarte?'];
                }
            }

            // 6. Final fallback: Flow Engine
            const engineResponse = await this.flowEngine.processMessage(phone, text, { ...context, pushName, remoteJid });
            return this.extractMessages(engineResponse);

        } catch (err: any) {
            logger.error(`[Router] Critical Error`, { error: err.message, phone });
            return ['⚠️ Ocurrió un error. Escribí "Cancelar" para reiniciar.'];
        }
    }

    private async handleCatalogOrder(phone: string, catalogItems: any[], metadata: any, pushName: string, context: any): Promise<any[]> {
        logger.info(`[CATALOG] New order detected`, { phone, itemCount: catalogItems.length });
        
        const { productService } = require('../../services/ProductService');
        const verifiedItems = [];
        const notFound = [];
        let total = 0;

        for (const item of catalogItems) {
            const product = await productService.findProduct(item.product);
            if (product) {
                const price = productService.getEffectivePrice(product);
                verifiedItems.push({
                    qty: item.qty,
                    name: product.name,
                    price: price,
                    catalog_item_id: product.id
                });
                total += price * item.qty;
            } else {
                notFound.push(item.product);
            }
        }

        if (verifiedItems.length === 0) {
            return [`⚠️ No encontramos los productos solicitados. Escribí *menú* para ver los disponibles.`];
        }

        const sessionId = this.getSessionId(phone, context);
        
        const { data: activeExec } = await supabase.from('flow_executions')
            .select('id')
            .eq('session_id', sessionId)
            .in('status', ['active', 'waiting_input'])
            .maybeSingle();

        if (activeExec) {
            console.log(`[Router] handleCatalogOrder: Archiving existing session ${activeExec.id} to prioritize new catalog order.`);
            await this.sessionRepository.archive(sessionId, 'catalog_order_priority');
        }
        
        const { data: draftOrder } = await supabase.from('draft_orders').insert({
            phone,
            items: verifiedItems,
            total,
            push_name: metadata.pushName || pushName || 'Cliente',
            status: 'pending_suggestion',
            metadata: metadata,
            delivery_method: metadata.delivery_method,
            payment_method: metadata.payment_method
        }).select().single();

        if (draftOrder) {
            let msg = `✅ *¡Carrito recibido!*\n`;
            if (notFound.length > 0) msg += `\n⚠️ No encontramos stock de: ${notFound.join(', ')}\n`;
            
            const itemsSummary = verifiedItems.map(i => `• ${i.qty}x ${i.name} ($${i.price * i.qty})`).join('\n');
            msg += `\nResumen:\n${itemsSummary}\n*Total: $${total}*\n`;
            
            msg += `\n¿Te gustaría agregar algo para tomar o algún postre? 🥤🍰\n(Decime qué querés agregar o respondé *NO* para continuar con el pago/envío)`;
            return [msg];
        }
        return [];
    }

    private async handleOverrideResponse(phone: string, cleanText: string, context: any, pushName: string, sessionId: string): Promise<any[] | null> {
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: pendingDraft } = await supabase.from('draft_orders')
            .select('*')
            .eq('phone', phone)
            .in('status', ['pending_override', 'pending_suggestion'])
            .gte('created_at', fifteenMinsAgo)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!pendingDraft && !context.last_inquiry) return null;

        const lower = cleanText.toLowerCase().trim();
        const isYes = ['si', 'sí', 'dale', 'anotame', 'anotá', 'quiero', 'bueno', 'terminar', 'termina', 'termino', 'finalizar', 'finaliza', 'finalizo'].some(word => lower.includes(word));
        const isNo = /\bno\b/i.test(lower) || ['incorrecto', 'nada que ver', 'borralo', 'cancelar', 'olvidalo'].some(word => lower.includes(word));
        const isRemoval = ['quitar', 'sacar', 'no quiero', 'borrar', 'eliminar'].some(word => lower.includes(word));

        if (isNo) {
            await supabase.from('draft_orders').update({ status: 'abandoned' }).eq('id', pendingDraft?.id);
            const messages = ['De acuerdo, seguimos con lo que estabas haciendo. 👍'];
            const engineResponse = await this.flowEngine.resumeSession(phone, { ...context, pushName });
            return [...messages, ...this.extractMessages(engineResponse)];
        }

        if (isYes) {
            // Case A: Confirming a suggested order
            if (pendingDraft) {
                const sessionId = this.getSessionId(phone, context);
                await this.sessionRepository.archive(sessionId, 'catalog_override');
                
                // Check if the user also included a product in this message (e.g. "si 1 coca cola")
                const extraText = lower.replace(/\b(si|sí|dale|anotame|anota|quiero|bueno)\b/g, '').trim();
                
                if (extraText.length > 2) {
                    // Try to parse extra products from the rest of the message
                    const { productService } = require('../../services/ProductService');
                    const interpreterResult = await this.nluInterpreter.interpret(extraText);
                    
                    if (interpreterResult.type === 'direct_order' && interpreterResult.parsedOrder && interpreterResult.parsedOrder.items.length > 0) {
                        let currentItems = Array.isArray(pendingDraft.items) ? [...pendingDraft.items] : [];
                        
                        for (const item of interpreterResult.parsedOrder.items) {
                            const similar = await productService.searchSimilarProducts(item.productName);
                            const isAmbiguous = ['coca', 'sprite', 'pepsi', 'fanta', 'cerveza', 'agua', 'vino', 'gaseosa'].some(w => item.productName.toLowerCase().includes(w));
                            
                            if (similar.length > 1 && isAmbiguous) {
                                // Save pending options and move to suggestion state
                                const options = similar.map((p: any) => ({ id: p.id, name: p.name, price: productService.getEffectivePrice(p) }));
                                const meta = { ...(pendingDraft.metadata || {}), pending_options: options, pending_qty: item.quantity || 1 };
                                await supabase.from('draft_orders').update({ status: 'pending_suggestion', metadata: meta }).eq('id', pendingDraft.id);
                                
                                const optionsList = options.map((p: any, i: number) => `${i + 1}. ${p.name} ($${p.price})`).join('\n');
                                return [`¡Anotado lo anterior! 📝\n\nPara la bebida encontré varias opciones. ¿Cuál preferís?\n\n${optionsList}\n\nResponde con el *número*, el *nombre*, o decime *NO* para avanzar.`];
                            }
                            
                            const product = similar.length > 0 ? similar[0] : null;
                            if (product) {
                                const price = productService.getEffectivePrice(product);
                                currentItems.push({
                                    qty: item.quantity || 1,
                                    name: product.name,
                                    price: price,
                                    catalog_item_id: product.id
                                });
                            }
                        }
                        
                        const newTotal = currentItems.reduce((sum: number, i: any) => sum + (i.price * i.qty), 0);
                        await supabase.from('draft_orders').update({ items: currentItems, total: newTotal, status: 'pending_suggestion' }).eq('id', pendingDraft.id);
                        
                        const itemsSummary = currentItems.map((i: any) => `• ${i.qty}x ${i.name} ($${i.price * i.qty})`).join('\n');
                        return [`¡Excelente! Anoté todo: 📝\n\n${itemsSummary}\n*Total: $${newTotal}*\n\n¿Querés sumar algo más? (Respondé *NO* para avanzar)`];
                    }
                }
                
                // Plain confirmation with no extra products
                await supabase.from('draft_orders').update({ status: 'pending_suggestion' }).eq('id', pendingDraft.id);
                return ['¡Excelente! Ya lo anoté. 📝\n\n¿Te gustaría agregar algo para tomar o algún postre? 🥤🍰\n(Decime qué querés agregar o respondé *NO* para avanzar)'];
            }

            // Case B: Confirming an inquired product (e.g. "Sí, anotame uno")
            if (context.last_inquiry) {
                const inquiry = context.last_inquiry;
                const item = {
                    qty: 1,
                    name: inquiry.name,
                    price: inquiry.price,
                    catalog_item_id: inquiry.productId
                };

                await this.getOrCreateActiveDraft(phone, [item], inquiry.price, context, 'pending_override');
                const sessionId = this.getSessionId(phone, context);
                await this.sessionRepository.updateContext(sessionId, { last_inquiry: null });

                return [
                    `¡Excelente elección! Ya anoté *1x ${inquiry.name}*. 📝`,
                    `¿Querés agregar algo más o ya confirmamos el pedido? (Decime "confirmar" o "quitar X" si te arrepentiste)`
                ];
            }
        }
        
        if (isRemoval) {
            const extraction = await this.nluExtractor.extract(cleanText);
            const productsToRemove = extraction.filter(e => e.type === 'product');

            if (productsToRemove.length > 0) {
                const uniqueRemovals = productsToRemove.reduce((acc: any[], current) => {
                    const id = current.metadata?.productId;
                    if (id && !acc.find(t => t.metadata?.productId === id)) acc.push(current);
                    return acc;
                }, []);

                let currentItems = Array.isArray(pendingDraft.items) ? [...pendingDraft.items] : [];
                let removedAny = false;

                for (const toRemove of uniqueRemovals) {
                    const productId = toRemove.metadata?.productId;
                    const index = currentItems.findIndex(item => {
                        const matchId = productId && item.catalog_item_id === productId;
                        if (matchId) return true;
                        const cleanItemName = item.name.toLowerCase().trim();
                        const cleanRemovedName = toRemove.normalizedValue.toLowerCase().trim();
                        if (cleanItemName === cleanRemovedName) return true;
                        return false;
                    });
                    
                    if (index !== -1) {
                        currentItems.splice(index, 1);
                        removedAny = true;
                    }
                }

                if (removedAny) {
                    if (currentItems.length === 0) {
                        await supabase.from('draft_orders').update({ status: 'abandoned' }).eq('id', pendingDraft.id);
                        return ['Entendido, quité todo lo del pedido. Escribí *menú* para empezar de nuevo o decime qué querés pedir.'];
                    }

                    const newTotal = currentItems.reduce((sum: number, i: any) => sum + (i.price * i.qty), 0);
                    await supabase.from('draft_orders').update({ items: currentItems, total: newTotal }).eq('id', pendingDraft.id);

                    const itemsSummary = currentItems.map((i: any) => `• ${i.qty}x ${i.name} ($${i.price * i.qty})`).join('\n');
                    return [`Entendido, actualicé el pedido. ¿Ahora está bien?\n\nAnote lo siguiente:\n${itemsSummary}\n\n*Total: $${newTotal}*\n\n¿Es correcto? (Responde con *SÍ* o *NO*)\n💡 _Podés decir "quitar X" si me equivoqué._`];
                }
            }
            return ['No entendí qué querés quitar. ¿Podés repetirlo? (Ej: "quitar pure de papas")'];
        }

        // If it's none of the above, just tell them we're waiting for confirmation
        return ['🤔 No me quedó claro... ¿Es correcta la lista anterior? Responde con *SÍ* o *NO*, o decime qué querés quitar (ej: "quitar papas").'];
    }

    private async handleSuggestionResponse(phone: string, cleanText: string, draft: any, context: any, pushName: string, sessionId: string): Promise<any[]> {
        const lower = cleanText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const { productService } = require('../../services/ProductService');

        const isNo = /\bno\b/i.test(lower) || [
            'nada', 'asi esta bien', 'continuar', 'solo eso', 'listo',
            'esta bien', 'nada mas', 'eso es todo', 'ya esta',
            'con eso', 'suficiente', 'paso', 'no gracias', 'avanzar', 'seguir',
            'todo bien', 'asi nomas', 'terminar mi pedido', 'termina mi pedido', 'finaliza mi pedido',
            'termina el pedido', 'cerrar pedido', 'cerrar', 'no quiero nada mas',
            'terminar', 'finalizar', 'finaliza', 'termina'
        ].some(word => lower.includes(word));

        // Positive confirmations like 'si', 'dale', 'vamos' should ALSO proceed to checkout
        const isYes = !isNo && [
            'si', 'sí', 'dale', 'vamos', 'ok', 'bueno', 'perfecto', 'correcto',
            'esta bien', 'de acuerdo', 'genial', 'claro'
        ].some(word => lower === word || lower === word + '!');
        
        const isRemoval = ['quitar', 'sacar', 'no quiero', 'borrar', 'eliminar'].some(word => lower.includes(word));

        if (isRemoval) {
            return (await this.handleOverrideResponse(phone, cleanText, context, pushName, sessionId)) || [];
        }

        if ((isNo || isYes) && !isRemoval) {
            // If the cart is completely empty and they say "no", they just rejected the options.
            if ((!draft.items || draft.items.length === 0) && isNo) {
                await supabase.from('draft_orders').update({ status: 'abandoned' }).eq('id', draft.id);
                return ['¡Entendido! ¿Buscabas alguna otra cosa? Podés escribir *menú* para ver nuestras categorías.'];
            }

            // Clear pending options and proceed to checkout
            const meta = draft.metadata || {};
            delete meta.pending_options;
            await supabase.from('draft_orders').update({ status: 'pending', metadata: meta }).eq('id', draft.id);
            const payload = this.prepareCatalogPayload(draft, meta);
            
            // Force reset session before checkout to ensure a fresh start of the checkout flow
            logger.info(`[DEBUGLOG] Proceeding to checkout for ${phone}. Draft: ${draft.id}`);
            await this.sessionRepository.forceReset(phone.replace(/[^0-9]/g, ''));
            
            logger.info(`[DEBUGLOG] Calling FlowEngine for 'checkout' with flowId override.`);
            const response = await this.flowEngine.processMessage(phone, "checkout", { ...context, ...payload, pushName }, { 
                flowId: "pedido", // Use name as ID for smart resolution 
                startNodeId: "n_ask_delivery" 
            });
            logger.info(`[DEBUGLOG] FlowEngine response received`, { responseLength: response.currentStateDefinition?.message_template?.length });
            return ['Perfecto, seguimos con el pedido.', ...this.extractMessages(response)];
        }

        // --- Check if there are pending options from a previous ambiguity question ---
        const pendingOptions = draft.metadata?.pending_options;
        if (pendingOptions && Array.isArray(pendingOptions) && pendingOptions.length > 0) {
            const selectedProduct = this.resolveSelection(lower, pendingOptions);
            
            if (selectedProduct) {
                let currentItems = Array.isArray(draft.items) ? [...draft.items] : [];
                const price = productService.getEffectivePrice(selectedProduct);
                const pendingQty = draft.metadata?.pending_qty || 1;
                currentItems.push({
                    qty: pendingQty,
                    name: selectedProduct.name,
                    price: price,
                    catalog_item_id: selectedProduct.id
                });
                
                const newTotal = currentItems.reduce((sum: number, i: any) => sum + (i.price * i.qty), 0);
                const meta = { ...draft.metadata };
                delete meta.pending_options;
                delete meta.pending_qty;
                await supabase.from('draft_orders').update({ items: currentItems, total: newTotal, metadata: meta }).eq('id', draft.id);
                
                const itemsSummary = currentItems.map((i: any) => `• ${i.qty}x ${i.name} ($${i.price * i.qty})`).join('\n');
                return [
                    `¡Agregado! 📝\n\nTu pedido ahora quedó así:\n${itemsSummary}\n*Total: $${newTotal}*\n\n¿Querés sumar algo más? (Respondé *NO* para avanzar)`
                ];
            }
            
            // Could not resolve — re-show the options
            const optionsList = pendingOptions.map((p: any, i: number) => `${i + 1}. ${p.name} ($${p.price})`).join('\n');
            return [`No pude identificar cuál querés. Elegí por número:\n\n${optionsList}\n\nO decime *NO* para avanzar.`];
        }

        // --- Normal suggestion flow: try to identify products ---
        const nluResult = await this.nluExtractor.extract(cleanText);
        const productsToAdd = nluResult.filter(e => e.type === 'product');

        if (productsToAdd.length > 0) {
            const interpreterResult = await this.nluInterpreter.interpret(cleanText);
            if (interpreterResult.type === 'direct_order' && interpreterResult.parsedOrder && interpreterResult.parsedOrder.items.length > 0) {
                let currentItems = Array.isArray(draft.items) ? [...draft.items] : [];
                
                for (const item of interpreterResult.parsedOrder.items) {
                     const similar = await productService.searchSimilarProducts(item.productName);
                     
                     // Detect ambiguous generic requests
                     const isAmbiguous = ['coca', 'sprite', 'pepsi', 'fanta', 'cerveza', 'agua', 'vino', 'gaseosa'].some(w => item.productName.toLowerCase().includes(w));
                     if (similar.length > 1 && isAmbiguous) {
                         // Save options to draft metadata so the next message can resolve them
                         const options = similar.map((p: any) => ({ id: p.id, name: p.name, price: productService.getEffectivePrice(p) }));
                         const meta = { ...(draft.metadata || {}), pending_options: options, pending_qty: item.quantity || 1 };
                         await supabase.from('draft_orders').update({ metadata: meta }).eq('id', draft.id);
                         
                         const optionsList = options.map((p: any, i: number) => `${i + 1}. ${p.name} ($${p.price})`).join('\n');
                         return [`Encontré varias opciones. ¿Cuál preferís?\n\n${optionsList}\n\nResponde con el *número*, el *nombre*, o decime *NO* para avanzar.`];
                     }

                     const product = similar.length > 0 ? similar[0] : null;

                     if (product) {
                         const price = productService.getEffectivePrice(product);
                         currentItems.push({
                              qty: item.quantity || 1,
                              name: product.name,
                              price: price,
                              catalog_item_id: product.id
                         });
                     }
                }
                const newTotal = currentItems.reduce((sum: number, i: any) => sum + (i.price * i.qty), 0);
                await supabase.from('draft_orders').update({ items: currentItems, total: newTotal }).eq('id', draft.id);
                
                const itemsSummary = currentItems.map((i: any) => `• ${i.qty}x ${i.name} ($${i.price * i.qty})`).join('\n');
                return [
                    `¡Agregado! 📝\n\nTu pedido ahora quedó así:\n${itemsSummary}\n*Total: $${newTotal}*\n\n¿Querés sumar algo más? (Respondé *NO* para avanzar)`
                ];
            }
        }

        if (lower === 'si' || lower === 'si' || lower === 'quiero' || lower === 'dale') {
            return ['¿Qué te gustaría agregar? Tenemos gaseosas, cervezas, postres... Decime qué buscas.'];
        }

        // --- AI Fallback for contextual awareness ---
        // If they say "hola" or ask a question during checkout, handle it gracefully
        try {
            const aiAnalysis = await AIExtractor.analyze(cleanText);
            
            if (aiAnalysis.intent === 'greeting') {
                const itemsSummary = Array.isArray(draft.items) ? draft.items.map((i: any) => `• ${i.qty || i.quantity || 1}x ${i.name}`).join('\n') : '';
                return [`¡Hola de nuevo! Recordá que estabas armando este pedido:\n${itemsSummary}\n\n¿Te gustaría agregar algo para tomar o algún postre? 🥤🍰\n(Decime qué querés o respondé *NO* para continuar)`];
            }
            
            if (aiAnalysis.intent === 'menu_request') {
                await this.sessionRepository.archive(sessionId, 'ai_menu_request_override');
                // The bot will now answer with the menu, but the draft is technically still in the DB 
                // However, they can start a new flow.
                const engineResponse = await this.flowEngine.processMessage(phone, 'menu', { ...context, pushName });
                return this.extractMessages(engineResponse);
            }

            if (aiAnalysis.intent === 'inquiry' || aiAnalysis.intent === 'support') {
                return await this.handleAIInquiry(phone, aiAnalysis, cleanText, sessionId);
            }
        } catch (error) {
            console.error('[Router] Fallback AI Analysis failed in suggestion response', error);
        }

        return ['No te entendí bien. ¿Querés agregar algo más (bebida/postre) o continuamos con el envío/pago? Respondé *NO* para avanzar.'];
    }

    /**
     * Resolves a user selection (number, ordinal, or name) against a list of options.
     */
    private resolveSelection(lower: string, options: any[]): any | null {
        // 1. Ordinal selection
        const ordinalMap: Record<string, number> = {
            'primera': 0, 'la primera': 0, 'el primero': 0, 'primero': 0,
            'segunda': 1, 'la segunda': 1, 'el segundo': 1, 'segundo': 1,
            'tercera': 2, 'la tercera': 2, 'el tercero': 2, 'tercero': 2,
            'cuarta': 3, 'la cuarta': 3, 'el cuarto': 3, 'cuarto': 3,
            'quinta': 4, 'la quinta': 4, 'el quinto': 4, 'quinto': 4
        };
        
        for (const [key, idx] of Object.entries(ordinalMap)) {
            if (lower.includes(key) && idx < options.length) {
                return options[idx];
            }
        }
        
        // 2. Numeric selection ("1", "2", "3")
        const numMatch = lower.match(/\b(\d)\b/);
        if (numMatch) {
            const idx = parseInt(numMatch[1]) - 1;
            if (idx >= 0 && idx < options.length) return options[idx];
        }

        // 3. Size keywords (only for beverages/sizes)
        const sizeKeywords: Record<string, string[]> = {
            'chica': ['500', 'cc', 'pequeña', 'chiquita'],
            'mediana': ['1.5', '1,5', 'litro y medio'],
            'grande': ['2', '2 1/4', '2.25', 'litros', 'familiar', 'grande'],
        };
        
        for (const [size, keywords] of Object.entries(sizeKeywords)) {
            if (lower.includes(size) || keywords.some(kw => lower.includes(kw))) {
                for (const opt of options) {
                    const optLower = opt.name.toLowerCase();
                    if (size === 'chica' && (optLower.includes('500') || (optLower.includes('cc') && !optLower.includes('1')))) return opt;
                    if (size === 'mediana' && (optLower.includes('1.5') || optLower.includes('1,5'))) return opt;
                    if (size === 'grande' && (optLower.includes('2') || optLower.includes('litro') || optLower.includes('familiar'))) return opt;
                }
            }
        }

        // 4. Direct name matching
        let bestMatch: any = null;
        let bestScore = 0;
        const normalizedInput = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const inputTokens = normalizedInput.split(/\s+/).filter(w => w.length > 2);

        for (const opt of options) {
            const normOpt = opt.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const optTokens = normOpt.split(/\s+/).filter(w => w.length > 2);
            
            let matchCount = 0;
            for (const it of inputTokens) {
                if (optTokens.some(ot => ot.includes(it) || it.includes(ot))) matchCount++;
            }
            
            const score = inputTokens.length > 0 ? matchCount / inputTokens.length : 0;
            if (score > bestScore && score >= 0.5) {
                bestScore = score;
                bestMatch = opt;
            }
        }
        
        return bestMatch;
    }

    private prepareCatalogPayload(draftOrder: any, metadata: any): any {
        const payload: Record<string, any> = { draft_order_id: draftOrder.id };
        const deliv = metadata.delivery_method || draftOrder.delivery_method;
        const pay = metadata.payment_method || draftOrder.payment_method;
        const addr = metadata.delivery_address;
        if (deliv) { payload.delivery_method = deliv; payload.tipo_entrega = deliv; }
        if (pay) { payload.payment_method = pay; payload.metodo_pago = pay; }
        if (addr) { payload.delivery_address = addr; payload.direccion = addr; }
        return payload;
    }

    private extractMessages(engineResponse: any): any[] {
        if (!engineResponse) return [];
        if (engineResponse.currentStateDefinition) {
            const template = engineResponse.currentStateDefinition.message_template;
            return Array.isArray(template) ? template : (template ? [template] : []);
        } 
        if (Array.isArray(engineResponse)) return engineResponse;
        return [engineResponse];
    }

    async handlePollUpdate(phone: string, voteHash: string): Promise<any[]> {
        const resolvedText = await this.flowEngine.resolvePollVote(phone, voteHash);
        if (resolvedText) return await this.processMessage(phone, resolvedText, 'Usuario');
        return [];
    }

    private async handleNluProductInquiry(phone: string, nlu: any, context: any, sessionId: string): Promise<any[]> {
        const productEntity = nlu.entities.find((e: any) => e.type === 'product');
        if (!productEntity) return ['¿De qué producto me preguntás? Podés decir "tenés tarta?" o consultarme por precios.'];

        const term = productEntity.value || nlu.text;
        const similar = await productService.searchSimilarProducts(term);

        if (similar.length === 0) return ['No pude encontrar ese producto en el menú ahora mismo.'];

        // If generic query (multiple high-score matches), show options
        if (similar.length > 1) {
            const options = similar.map(p => ({
                id: p.id,
                name: p.name,
                price: productService.getEffectivePrice(p)
            }));
            await this.getOrCreateActiveDraft(phone, [], 0, context, 'pending_suggestion', { pending_options: options });
            
            const list = options.map((opt, i) => `${i + 1}. ${opt.name} ($${opt.price})`).join('\n');
            return [
                `Encontré varias opciones de *${term}*. ¿Cuál buscabas?\n\n${list}\n\nResponde con el *número* o el *nombre*.`
            ];
        }

        const product = similar[0];
        const hasStock = (product.stock || 0) > 0 || product.category === 'Bebidas';
        const price = productService.getEffectivePrice(product);
        
        // Save inquiry context to allow "si" response to create an order
        await this.sessionRepository.updateContext(sessionId, {
            last_inquiry: {
                productId: product.id,
                name: product.name,
                price: price
            },
            last_options: null // Clear options if we found a direct match
        });

        if (hasStock) {
            return [`Sí, tenemos *${product.name}* a *$${price}*. 😋\n\n¿Te gustaría que te anote uno?`];
        } else {
            return [`Por el momento no nos queda stock de *${product.name}*. 😔 ¿Te gustaría ver otras opciones de nuestro menú?`];
        }
    }

    private async handleNluCategoryInquiry(phone: string, nlu: any, context: any, sessionId: string): Promise<any[]> {
        const categoryEntity = nlu.entities.find((e: any) => e.type === 'category');
        const productEntity = nlu.entities.find((e: any) => e.type === 'product');
        
        let categoryName = categoryEntity?.normalizedValue;

        // If no category entity found, use the category of the matched product
        if (!categoryName && productEntity) {
            categoryName = productEntity.metadata?.category;
        }

        if (!categoryName) return ['¿De qué variedades te gustaría saber? Podés preguntarme por "empanadas", "pizzas", etc.'];

        const products = await productService.findProductsByCategory(categoryName);
        
        if (products.length === 0) {
            return [`No encontré variedades de *${categoryName}* en este momento. Podés consultar por nuestro menú completo.`];
        }

        const options = products.map(p => ({
            id: p.id,
            name: p.name,
            price: productService.getEffectivePrice(p)
        }));

        await this.getOrCreateActiveDraft(phone, [], 0, context, 'pending_suggestion', { pending_options: options });

        const list = options.map((opt, i) => `${i + 1}. ${opt.name} ($${opt.price})`).join('\n');

        return [
            `De *${categoryName}* tenemos estas opciones:\n\n${list}\n\n¿Cuál te gustaría pedir?`
        ];
    }

    private async getOrCreateActiveDraft(phone: string, newItems: any[], newTotal: number, context: any, status: string, metadata: any = {}): Promise<any> {
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        
        // 1. Check for existing active draft
        const { data: existing } = await supabase.from('draft_orders')
            .select('*')
            .eq('phone', phone)
            .in('status', ['pending_suggestion', 'pending_override'])
            .gte('created_at', fifteenMinsAgo)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existing) {
            logger.info(`[Draft] Merging into existing draft ${existing.id}. Current items: ${existing.items?.length || 0}`);
            
            // Combine current and new items, then deduplicate/group everything
            const currentItems = Array.isArray(existing.items) ? existing.items : [];
            const allItems = [...currentItems, ...newItems];
            const deduplicatedItems: any[] = [];

            for (const item of allItems) {
                const existingIdx = deduplicatedItems.findIndex(i => 
                    (i.catalog_item_id && item.catalog_item_id && i.catalog_item_id === item.catalog_item_id) ||
                    (i.name && item.name && i.name.toLowerCase().trim() === item.name.toLowerCase().trim())
                );
                
                if (existingIdx !== -1) {
                    deduplicatedItems[existingIdx].qty += item.qty;
                } else {
                    deduplicatedItems.push({ ...item });
                }
            }

            const mergedTotal = deduplicatedItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
            const mergedMeta = { 
                ...(existing.metadata || {}), 
                ...metadata,
                push_name: context.pushName || (existing.metadata?.push_name) || 'Cliente'
            };

            const { data: updated, error: updateError } = await supabase.from('draft_orders')
                .update({ 
                    items: deduplicatedItems, 
                    total: mergedTotal, 
                    status: status,
                    metadata: mergedMeta 
                })
                .eq('id', existing.id)
                .select()
                .maybeSingle();
            
            if (updateError) {
                logger.error(`[Draft] Error updating draft ${existing.id}`, { error: updateError.message });
                return null;
            }

            logger.info(`[Draft] Updated draft ${existing.id}. New item count: ${deduplicatedItems.length}`);
            return updated;
        } else {
            // Create new draft
            const { data: inserted, error: insertError } = await supabase.from('draft_orders').insert({
                phone,
                items: newItems,
                total: newTotal,
                status: status,
                metadata: {
                    ...metadata,
                    push_name: context.pushName || 'Cliente'
                }
            }).select().maybeSingle();
            
            if (insertError) {
                logger.error(`[Draft] Error creating new draft for ${phone}`, { error: insertError.message });
                return null;
            }

            return inserted;
        }
    }

    private async handleNluDirectOrder(phone: string, nlu: any, context: any, sessionId: string): Promise<any[]> {
        const items = nlu.parsedOrder.items;
        logger.info(`[NLU] Handling direct order`, { phone, items: items.length, confidence: nlu.confidence });

        if (items.length === 0) return [];

        // 1. Check Inventory
        const stock = await inventoryManager.checkAvailability(items);
        
        if (!stock.available) {
            let msg = `😔 *Perdón, pero no tengo stock suficiente de:* \n`;
            const alts = [];
            for (const issue of stock.issues) {
                msg += `• ${issue.name} (pediste ${issue.requested}, quedan ${issue.available})\n`;
                const itemAlts = await inventoryManager.findAlternatives(issue.productId);
                if (itemAlts.length > 0) alts.push({ original: issue.name, options: itemAlts });
            }

            if (alts.length > 0) {
                msg += `\n*¿Te gustaría probar con alguna de estas opciones?*\n`;
                for (const alt of alts) {
                    msg += `\n*En lugar de ${alt.original}:*\n`;
                    alt.options.forEach((o, i) => msg += `${i+1}️⃣ ${o.name} ($${o.price})\n`);
                }
            }
            return [msg];
        }

        // 2. Build Draft Order
        const verifiedItems = items.map((i: any) => ({
            qty: i.quantity,
            name: i.productName,
            price: i.basePrice,
            catalog_item_id: i.productId
        }));

        const total = items.reduce((sum: number, i: any) => sum + (i.basePrice * i.quantity), 0);
        const isHighConfidence = nlu.confidence > 0.8;
        const status = isHighConfidence ? 'pending_suggestion' : 'pending_override';

        const draftOrder = await this.getOrCreateActiveDraft(
            phone, 
            verifiedItems, 
            total, 
            context, 
            status, 
            { nlu_source: true, nlu_confidence: nlu.confidence }
        );

        if (draftOrder) {
            const itemsSummary = draftOrder.items.map((i: any) => `• ${i.qty}x ${i.name} ($${i.price * i.qty})`).join('\n');
            const totalDisplay = draftOrder.total;
            
            if (isHighConfidence) {
                let msg = `✅ *¡Entendido! Acabo de anotar tu pedido:*\n\n${itemsSummary}\n\n*Total: $${totalDisplay}*`;
                msg += `\n\n¿Te gustaría agregar algo para tomar o algún postre? 🥤🍰\n(Decime qué querés agregar o respondé *NO* para avanzar)`;
                return [msg];
            } else {
                // Lower confidence: suggest and wait for confirmation (SÍ/NO)
                let msg = `🤔 *¿Entendí bien?*\n\nAnote lo siguiente:\n${itemsSummary}\n\n*Total: $${totalDisplay}*\n\n¿Es correcto? (Responde con *SÍ* o *NO*)\n💡 _Podés decir "quitar X" si me equivoqué._`;
                return [msg];
            }
        }

        return [];
    }

    // ============================================================
    // AI-POWERED HANDLERS (Groq LLM)
    // ============================================================

    private async handleAIOrder(phone: string, aiResult: any, context: any, pushName: string, sessionId: string): Promise<any[]> {
        logger.info(`[AI Order] Processing AI-extracted order`, { phone, items: aiResult.items.length });

        const verifiedItems: any[] = [];
        const ambiguousItems: any[] = [];
        const notFoundItems: string[] = [];

        for (const item of aiResult.items) {
            if (item.resolvedProduct) {
                verifiedItems.push({
                    qty: item.quantity,
                    name: item.resolvedProduct.name,
                    price: item.resolvedProduct.price,
                    catalog_item_id: item.resolvedProduct.id,
                });
            } else if ((item as any).ambiguousOptions) {
                ambiguousItems.push(item);
            } else {
                notFoundItems.push(item.rawName);
            }
        }

        // If we have ambiguous items, ask the user to clarify
        if (ambiguousItems.length > 0 && verifiedItems.length === 0) {
            const first = ambiguousItems[0];
            const options = (first as any).ambiguousOptions;
            const optionsList = options.map((p: any, i: number) => `${i + 1}. ${p.name} ($${p.price})`).join('\n');
            return [`Encontré varias opciones para *${first.rawName}*. ¿Cuál preferís?\n\n${optionsList}\n\nResponde con el *número* o el *nombre*.`];
        }

        if (verifiedItems.length === 0) {
            return ['No pude identificar los productos del mensaje. ¿Podés repetirlo? O escribí *menú* para ver lo disponible.'];
        }

        const total = verifiedItems.reduce((sum: number, i: any) => sum + (i.price * i.qty), 0);

        // Build metadata from AI extraction (address, payment, delivery)
        const metadata: any = { ai_source: true };
        if (aiResult.address) metadata.delivery_address = aiResult.address;
        if (aiResult.paymentMethod) metadata.payment_method = aiResult.paymentMethod;
        if (aiResult.deliveryMethod) metadata.delivery_method = aiResult.deliveryMethod;
        if (aiResult.customerName) metadata.customer_name = aiResult.customerName;

        const draftOrder = await this.getOrCreateActiveDraft(
            phone,
            verifiedItems,
            total,
            { ...context, pushName },
            'pending_suggestion',
            metadata
        );

        if (draftOrder) {
            const itemsSummary = draftOrder.items.map((i: any) => `• ${i.qty}x ${i.name} ($${i.price * i.qty})`).join('\n');
            const totalDisplay = draftOrder.total;

            let msg = `✅ *¡Entendido!*\n\n${itemsSummary}\n\n*Total: $${totalDisplay}*`;
            if (notFoundItems.length > 0) {
                msg += `\n\n⚠️ No encontré: ${notFoundItems.join(', ')}`;
            }
            if (aiResult.address) {
                msg += `\n📍 Envío a: ${aiResult.address}`;
            }
            msg += `\n\n¿Querés agregar algo más o confirmamos? (Respondé *NO* para avanzar)`;
            return [msg];
        }

        return ['⚠️ No pude guardar tu pedido por un error técnico. Por favor, intentá de nuevo o pedí ayuda humana.'];
    }

    private async handleAIInquiry(phone: string, aiResult: any, text: string, sessionId: string): Promise<any[]> {
        // Use AI to generate a natural response based on the catalog
        const naturalResponse = await AIExtractor.generateNaturalResponse(text, aiResult);
        
        // Optional: Update context if a specific product was mentioned (best effort)
        const item = aiResult.items[0];
        if (item?.resolvedProduct) {
            await this.sessionRepository.updateContext(sessionId, {
                last_inquiry: {
                    productId: item.resolvedProduct.id,
                    name: item.resolvedProduct.name,
                    price: item.resolvedProduct.price,
                },
                last_options: null,
            });
        }

        return [naturalResponse];
    }
}

export default new ConversationRouter();
