import { IntentClassifier } from '../../flows/intents/classifier';
import { FlowEngine } from './flow.engine';
import { supabase } from '../../config/database';
import Parser from '../parser';
import orderService from '../../services/OrderService';
import slotService from '../../services/DeliverySlotService';
import { logger } from '../../utils/logger';

export class ConversationRouter {
    private intentClassifier: IntentClassifier;
    private flowEngine: FlowEngine;

    constructor() {
        this.intentClassifier = new IntentClassifier();
        this.flowEngine = new FlowEngine(undefined, orderService, slotService);
    }

    async processMessage(phone: string, text: string, pushName: string, context: any = {}): Promise<any[]> {
        const cleanText = text.trim().toLowerCase();
        
        logger.info(`Message received`, { 
            phone, 
            pushName, 
            text: text.substring(0, 50),
            isMedia: !!context._receivedFile || !!context._location 
        });

        try {
            // --- 0. PRE-CHECK: Handover Status (Human Support) ---
            let cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
            const { data: convo } = await supabase
                .from('whatsapp_conversations')
                .select('status')
                .eq('phone', cleanPhone)
                .maybeSingle();

            if (convo && convo.status === 'HANDOVER') {
                if (cleanText === 'reset' || cleanText === 'reiniciar' || cleanText === 'resume') {
                    logger.info(`[HANDOVER] Resuming bot`, { phone });
                    await supabase.from('whatsapp_conversations')
                        .update({ status: 'ACTIVE' })
                        .eq('phone', cleanPhone);
                    // Add trigger message to start fresh
                    text = 'hola'; 
                } else {
                    logger.debug(`[HANDOVER] Message ignored (Human active)`, { phone });
                    return []; 
                }
            }

            // --- 1. GLOBAL PRIORITY: Catalog Order Detection (V2) ---
            const catalogDataRaw = Parser.parseCatalogCheckout(text) || { items: Parser.parseCatalogOrder(text), metadata: null };
            const catalogItems = catalogDataRaw?.items;
            const metadata = (catalogDataRaw as any)?.metadata || {};

            if (catalogItems && catalogItems.length > 0) {
                logger.info(`[CATALOG] New order detected at Priority 0`, { phone, itemCount: catalogItems.length });
                
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

                if (verifiedItems.length > 0) {
                    // Check for existing active flow to determine status
                    const { data: activeExec } = await supabase.from('flow_executions')
                        .select('id')
                        .eq('phone', phone)
                        .eq('status', 'active')
                        .maybeSingle();

                    const draftStatus = activeExec ? 'pending_override' : 'pending';
                    
                    const { data: draftOrder, error: draftOrderError } = await supabase.from('draft_orders').insert({
                        phone,
                        items: verifiedItems,
                        total,
                        push_name: (metadata as any).pushName || pushName || 'Cliente',
                        status: draftStatus,
                        metadata: metadata,
                        delivery_method: (metadata as any).delivery_method,
                        payment_method: (metadata as any).payment_method
                    }).select().single();

                    if (draftOrderError) {
                        logger.error(`[CATALOG] Error creating draft_order`, { error: draftOrderError, phone });
                    }

                    if (draftOrder) {
                        if (activeExec) {
                            logger.info(`[CATALOG] Active session exists. Asking for override.`, { phone });
                            return [
                                `🛒 *Recibimos tu nuevo carrito:*`,
                                ...verifiedItems.map(i => `• ${i.name} x${i.qty}`),
                                `\n⚠️ *Atención:* Tenés una conversación en curso. ¿Querés descartarla y avanzar con este nuevo pedido?`,
                                `Responde *SI* para confirmar o *NO* para seguir como estabas.`
                            ];
                        } else {
                            const payload: Record<string, any> = { draft_order_id: draftOrder.id };
                            const deliv = (metadata as any).delivery_method;
                            const pay = (metadata as any).payment_method;
                            const addr = (metadata as any).delivery_address;

                            if (deliv) {
                                payload.delivery_method = deliv;
                                payload.tipo_entrega = deliv;
                            }
                            if (pay) {
                                payload.payment_method = pay;
                                payload.metodo_pago = pay;
                            }
                            if (addr) {
                                payload.delivery_address = addr;
                                payload.direccion = addr;
                            }
                            logger.info(`[Router] No active session. Starting fresh catalog flow.`, { phone });
                            const response = await this.flowEngine.processMessage(phone, "checkout_catalogo", payload);
                            let msg = `✅ *¡Carrito recibido!*\n`;
                            if (notFound.length > 0) msg += `\n⚠️ No encontramos stock de: ${notFound.join(', ')}\n\n`;
                            return [msg, ...this.extractMessages(response)];
                        }
                    }
                }
                if (notFound.length > 0) {
                    return [`⚠️ No encontramos estos productos: ${notFound.join(', ')}.\n\nEscribí *menú* para ver los disponibles.`];
                }
            }

            // --- 2. GLOBAL PRIORITY: Check for Active DB Flow ---
            const { data: activeExec } = await supabase.from('flow_executions')
                .select('id, flow_id, current_node_id')
                .eq('phone', phone)
                .eq('status', 'active')
                .maybeSingle();

            if (activeExec) {
                logger.debug(`[PRIORITY] Active flow found. Delegating...`, { phone, flowId: activeExec.flow_id });
                const engineResponse = await this.flowEngine.processMessage(phone, text, { ...context, pushName });
                return this.extractMessages(engineResponse);
            }

            // --- 3. PRE-CHECK: Catalog Override (Handle response to Priority 1 check) ---
            if (cleanText === 'si' || cleanText === 'sí' || cleanText === 'no') {
                const { data: pendingDraft } = await supabase.from('draft_orders')
                    .select('*')
                    .eq('phone', phone)
                    .eq('status', 'pending_override')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (pendingDraft) {
                    if (cleanText === 'no') {
                        logger.info(`[CATALOG] Override rejected`, { phone });
                        await supabase.from('draft_orders').update({ status: 'abandoned' }).eq('id', pendingDraft.id);
                        return ['De acuerdo, seguimos con lo que estabas haciendo. 👍'];
                    } else {
                        logger.info(`[CATALOG] Override accepted`, { phone });
                        // Cancel current flow execution
                        await supabase.from('flow_executions')
                            .update({ status: 'cancelled', completed_at: new Date() })
                            .eq('phone', phone)
                            .eq('status', 'active');

                        await supabase.from('draft_orders').update({ status: 'pending' }).eq('id', pendingDraft.id);
                        
                        const payload: Record<string, any> = { draft_order_id: pendingDraft.id };
                        const meta = pendingDraft.metadata || {};
                        const deliv = meta.delivery_method || pendingDraft.delivery_method;
                        const pay = meta.payment_method || pendingDraft.payment_method;
                        
                        if (deliv) {
                            payload.delivery_method = deliv;
                            payload.tipo_entrega = deliv;
                        }
                        if (pay) {
                            payload.payment_method = pay;
                            payload.metodo_pago = pay;
                        }

                        const response = await this.flowEngine.processMessage(phone, "checkout_catalogo", payload);
                        return ['¡Excelente! Empecemos con el carrito.', ...this.extractMessages(response)];
                    }
                }
            }

            // --- 4. DYNAMIC FLOW ENGINE (Default Handler) ---
            const engineResponse = await this.flowEngine.processMessage(phone, text, { ...context, pushName });
            return this.extractMessages(engineResponse);

        } catch (err: any) {
            logger.error(`[Router] Critical Error`, { error: err.message, phone });
            return ['⚠️ Ocurrió un error. Escribí "Cancelar" para reiniciar.'];
        }
    }

    private extractMessages(engineResponse: any): any[] {
        if (!engineResponse) return [];
        
        // Handle FlowEngine response format: { currentStateDefinition: { message_template: [...] } }
        if (engineResponse.currentStateDefinition) {
            const template = engineResponse.currentStateDefinition.message_template;
            return Array.isArray(template) ? template : (template ? [template] : []);
        } 
        
        // Handle direct message_template if it's top-level
        if (engineResponse.message_template) {
            const template = engineResponse.message_template;
            return Array.isArray(template) ? template : [template];
        }

        // Handle legacy array response
        if (Array.isArray(engineResponse)) {
            return engineResponse;
        }
        
        // Handle case where engineResponse is just a string or a single message object
        return [engineResponse];
    }

    async handlePollUpdate(phone: string, voteHash: string): Promise<any[]> {
        try {
            const resolvedText = await this.flowEngine.resolvePollVote(phone, voteHash);
            if (resolvedText) {
                logger.info(`[POLL] Resolved`, { phone, vote: resolvedText });
                return await this.processMessage(phone, resolvedText, 'Usuario');
            }
            logger.warn(`[POLL] Unresolved hash`, { phone, voteHash });
            return [];
        } catch (err: any) {
            logger.error(`[POLL] Handling Error`, { error: err.message, phone });
            return [];
        }
    }
}

export default new ConversationRouter();
