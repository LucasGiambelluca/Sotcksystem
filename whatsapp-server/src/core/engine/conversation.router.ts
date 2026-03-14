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
import { inventoryManager } from '../inventory/InventoryManager';

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

    async processMessage(phone: string, text: string, pushName: string, context: any = {}): Promise<any[]> {
        const cleanText = text.trim().toLowerCase();
        const sessionId = this.getSessionId(phone, context);
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const remoteJid = context.remoteJid || (cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`);
        
        logger.info(`Message routing`, { 
            sessionId, 
            pushName, 
            text: text.substring(0, 50)
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
                if (['reset', 'reiniciar', 'resume', 'hola'].includes(cleanText)) {
                    logger.info(`[HANDOVER] Resuming bot`, { phone });
                    await supabase.from('whatsapp_conversations')
                        .update({ status: 'ACTIVE' })
                        .eq('phone', cleanPhone);
                    // Continue to normal flow
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
                return this.handleCatalogOrder(phone, catalogItems, metadata, pushName, context);
            }

            // --- 2. GLOBAL PRIORITY: Override responses ---
            if (['si', 'sí', 'no'].includes(cleanText)) {
                const overrideResult = await this.handleOverrideResponse(phone, cleanText, context, pushName);
                if (overrideResult) return overrideResult;
            }

            // --- 3. DYNAMIC FLOW ENGINE (Default Handler) ---
            // NLU Attempt for direct orders
            const nluResult = await this.nluInterpreter.interpret(text);
            if (nluResult.type === 'direct_order' && nluResult.parsedOrder && nluResult.confidence > 0.7) {
                const nluMessages = await this.handleNluDirectOrder(phone, nluResult, context);
                if (nluMessages.length > 0) return nluMessages;
            }

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
            status: 'pending',
            metadata: metadata,
            delivery_method: metadata.delivery_method,
            payment_method: metadata.payment_method
        }).select().single();

        if (draftOrder) {
            const payload = this.prepareCatalogPayload(draftOrder, metadata);
            console.log(`[Router] handleCatalogOrder: Triggering checkout_catalogo with draft_order_id=${payload.draft_order_id}`);
            const response = await this.flowEngine.processMessage(phone, "checkout_catalogo", { ...context, ...payload, pushName });
            let msg = `✅ *¡Carrito recibido!*\n`;
            if (notFound.length > 0) msg += `\n⚠️ No encontramos stock de: ${notFound.join(', ')}\n\n`;
            return [msg, ...this.extractMessages(response)];
        }
        return [];
    }

    private async handleOverrideResponse(phone: string, cleanText: string, context: any, pushName: string): Promise<any[] | null> {
        const { data: pendingDraft } = await supabase.from('draft_orders')
            .select('*')
            .eq('phone', phone)
            .eq('status', 'pending_override')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!pendingDraft) return null;

        if (cleanText === 'no') {
            await supabase.from('draft_orders').update({ status: 'abandoned' }).eq('id', pendingDraft.id);
            const messages = ['De acuerdo, seguimos con lo que estabas haciendo. 👍'];
            
            // Resume current session if it exists to remind user of where they were
            const engineResponse = await this.flowEngine.resumeSession(phone, { ...context, pushName });
            return [...messages, ...this.extractMessages(engineResponse)];
        } else {
            const sessionId = this.getSessionId(phone, context);
            await this.sessionRepository.archive(sessionId, 'catalog_override');
            
            await supabase.from('draft_orders').update({ status: 'pending' }).eq('id', pendingDraft.id);
            const payload = this.prepareCatalogPayload(pendingDraft, pendingDraft.metadata || {});
            const response = await this.flowEngine.processMessage(phone, "checkout_catalogo", { ...context, ...payload, pushName });
            return ['¡Excelente! Empecemos con el carrito.', ...this.extractMessages(response)];
        }
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

    private async handleNluDirectOrder(phone: string, nlu: any, context: any): Promise<any[]> {
        const items = nlu.parsedOrder.items;
        logger.info(`[NLU] Handling direct order`, { phone, items: items.length });

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

        // 2. Build Draft Order (similar to Catalog flow)
        const verifiedItems = items.map((i: any) => ({
            qty: i.quantity,
            name: i.productName,
            price: i.basePrice,
            catalog_item_id: i.productId
        }));

        const total = items.reduce((sum: number, i: any) => sum + (i.basePrice * i.quantity), 0);
        const remoteJid = context.remoteJid || `${phone}@s.whatsapp.net`;
        const sessionId = remoteJid.endsWith('@g.us') ? `group:${remoteJid}` : `1to1:${remoteJid}`;

        const { data: draftOrder } = await supabase.from('draft_orders').insert({
            phone,
            items: verifiedItems,
            total,
            push_name: context.pushName || 'Cliente',
            status: 'pending',
            metadata: { nlu_source: true }
        }).select().single();

        if (draftOrder) {
            const payload = this.prepareCatalogPayload(draftOrder, {});
            const response = await this.flowEngine.processMessage(phone, "checkout_catalogo", { ...context, ...payload });
            let msg = `✅ *¡Entendido! Acabo de anotar tu pedido.*\n`;
            return [msg, ...this.extractMessages(response)];
        }

        return [];
    }
}

export default new ConversationRouter();
