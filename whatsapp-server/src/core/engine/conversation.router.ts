import { IntentClassifier } from '../../flows/intents/classifier';
import { FlowEngine } from './flow.engine';
import { supabase } from '../../config/database';
import Parser from '../parser';
import orderService from '../../services/OrderService';
import slotService from '../../services/DeliverySlotService';

export class ConversationRouter {
    private intentClassifier: IntentClassifier;
    private flowEngine: FlowEngine;

    constructor() {
        this.intentClassifier = new IntentClassifier();
        this.flowEngine = new FlowEngine(undefined, orderService, slotService);
    }

    async processMessage(phone: string, text: string, pushName: string, context: any = {}): Promise<any[]> {
        const cleanText = text.trim().toLowerCase();
        console.log(`[ConversationRouter] ${phone} | Msg: "${text}" | Processing...`);

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
                    console.log(`[HANDOVER] Resuming bot for ${phone}`);
                    await supabase.from('whatsapp_conversations')
                        .update({ status: 'ACTIVE' })
                        .eq('phone', cleanPhone);
                    // Add trigger message to start fresh
                    text = 'hola'; 
                } else {
                    console.log(`[HANDOVER] Ignored message from ${phone} (Human Agent Active)`);
                    return []; 
                }
            }

            // --- 1. PRE-CHECK: Catalog Override ---
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
                        await supabase.from('draft_orders').update({ status: 'abandoned' }).eq('id', pendingDraft.id);
                        return ['De acuerdo, seguimos con lo que estabas haciendo. 👍'];
                    } else {
                        // Cancel active executions
                        await supabase.from('flow_executions')
                            .update({ status: 'cancelled', completed_at: new Date() })
                            .eq('phone', phone).eq('status', 'active');
                        await supabase.from('draft_orders').update({ status: 'pending' }).eq('id', pendingDraft.id);
                        
                        const response = await this.flowEngine.processMessage(phone, "checkout_catalogo", { draft_order_id: pendingDraft.id });
                        const template = response?.currentStateDefinition?.message_template;
                        const flowMessages = Array.isArray(template) ? template : (template ? [template] : []);
                        return ['¡Excelente! Empecemos con el carrito.', ...flowMessages];
                    }
                }
            }

            // --- 2. PRE-CHECK: Catalog Order Detection (V2) ---
            const catalogItems = Parser.parseCatalogOrder(text);
            if (catalogItems && catalogItems.length > 0) {
                console.log(`[ConversationRouter] 🛒 Catalog order detected from ${phone}:`, catalogItems);
                const { productService } = require('../../services/ProductService');
                
                const verifiedItems = [];
                const notFound = [];
                let total = 0;

                for (const item of catalogItems) {
                    const product = await productService.findProduct(item.product);
                    if (product) {
                        verifiedItems.push({ qty: item.qty, name: product.name, price: product.price, product_id: product.id });
                        total += product.price * item.qty;
                    } else {
                        notFound.push(item.product);
                    }
                }

                if (verifiedItems.length > 0) {
                    const { data: activeExec } = await supabase.from('flow_executions')
                        .select('id').eq('phone', phone).eq('status', 'active').maybeSingle();

                    const { data: draftOrder } = await supabase.from('draft_orders').insert({
                        phone,
                        items: verifiedItems,
                        total,
                        push_name: pushName || 'Cliente',
                        status: activeExec ? 'pending_override' : 'pending'
                    }).select().single();

                    if (activeExec) {
                        return ['⚠️ Tenés un proceso en curso (consulta/pedido).\n\n¿Querés cancelarlo y empezar con este nuevo carrito del catálogo?\n\nRespondé *SÍ* para usar el carrito, o *NO* para seguir con lo anterior.'];
                    } else if (draftOrder) {
                        const response = await this.flowEngine.processMessage(phone, "checkout_catalogo", { draft_order_id: draftOrder.id });
                        let msg = `✅ *¡Carrito recibido!*\n`;
                        if (notFound.length > 0) msg += `\n⚠️ No encontramos stock de: ${notFound.join(', ')}\n\n`;
                        
                        const template = response?.currentStateDefinition?.message_template;
                        const flowMessages = Array.isArray(template) ? template : (template ? [template] : []);
                        return [msg, ...flowMessages];
                    }
                }
                if (notFound.length > 0) {
                    return [`⚠️ No encontramos estos productos: ${notFound.join(', ')}.\n\nEscribí *menú* para ver los disponibles.`];
                }
            }

            // --- 3. DYNAMIC FLOW ENGINE ---
            // Let the FlowEngine handle the actual message
            const engineResponse = await this.flowEngine.processMessage(phone, text, { ...context, pushName });
            
            if (engineResponse && engineResponse.currentStateDefinition) {
                 const template = engineResponse.currentStateDefinition.message_template;
                 if (Array.isArray(template)) return template;
                 return template ? [template] : [];
            } else if (Array.isArray(engineResponse)) {
                 return engineResponse;
            }

            return [];
        } catch (err) {
            console.error('[ConversationRouter] Critical Error:', err);
            return ['⚠️ Ocurrió un error. Escribí "Cancelar" para reiniciar.'];
        }
    }

    async handlePollUpdate(phone: string, voteHash: string): Promise<any[]> {
        try {
            const resolvedText = await this.flowEngine.resolvePollVote(phone, voteHash);
            if (resolvedText) {
                console.log(`[ConversationRouter] Poll Resolved: "${resolvedText}" for ${phone}`);
                return await this.processMessage(phone, resolvedText, 'Usuario');
            }
            console.warn(`[ConversationRouter] Could not resolve poll vote hash: ${voteHash}`);
            return [];
        } catch (err) {
            console.error('[ConversationRouter] Poll Handling Error:', err);
            return [];
        }
    }
}

export default new ConversationRouter();
