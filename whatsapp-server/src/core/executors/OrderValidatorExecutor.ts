import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';
import { logger } from '../../utils/logger';

export class OrderValidatorExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        logger.info('[OrderValidator] Building validation message...');
        
        // 1. Get items from context or draft order
        let items = Array.isArray(context.order_items) ? context.order_items : [];
        if (context.draft_order_id && items.length === 0) {
            const { supabase } = require('../../config/database');
            const { data: draftOrder } = await supabase
                .from('draft_orders')
                .select('items, total, delivery_fee')
                .eq('id', context.draft_order_id)
                .single();
            
            if (draftOrder && draftOrder.items) {
                items = draftOrder.items;
                // If it's a catalog order, prioritize the delivery fee saved in the draft
                if (draftOrder.delivery_fee > 0) {
                    context.shipping_cost = draftOrder.delivery_fee;
                }
            }
        }

        if (items.length === 0) {
            return {
                messages: ["🛒 Tu carrito parece estar vacío."],
                wait_for_input: false
            };
        }

        // --- NEW: Forced Pickup Detection ---
        // If coming from a rejected delivery (respuesta: 1 (SI)) and location was not validated
        if (context.respuesta === '1' && !context.location_validated) {
            logger.info('[OrderValidator] Detected forced pickup from rejected delivery. Syncing all method variables.');
            context.delivery_method = 'Retiro en local';
            context.envio_opcion = 'Retiro en local';
            context.tipo_entrega = 'Retiro en local';
            context.delivery_type = 'Retiro en local';
            context.location_validated = true; // Mark as validated to avoid further checks
            context.shipping_cost = 0; // Force free shipping for pickup
            // Clear all possible address keys to avoid persistence in catalog URLs
            context.direccion = '';
            context.address = '';
            context.deliveryAddress = '';
            context.direccion_raw = '';
            context.domicilio = '';
            context.dirección = '';
            context.dirrecion = '';
            context.direccion_cliente = '';
            context.direccion_cliente_raw = '';
            context.zona_delivery = '';
        }
        // ------------------------------------

        // 2. Build Summary Text
        let summaryText = data.message || '🛒 *Confirma tu pedido:*\n\n';
        let total = 0;

        for (const item of items) {
            const qty = item.qty || item.quantity || 1;
            const price = item.price || 0;
            const lineTotal = price * qty;
            total += lineTotal;
            // Normalize H/F suffixes to uppercase for professional look
            const displayName = item.name.replace(/ ([hf])$/i, (m: string, p1: string) => ' ' + p1.toUpperCase());
            summaryText += `• ${qty}x ${displayName} — $${lineTotal}\n`;
            if (item.notes) summaryText += `  _(Notas: ${item.notes})_\n`;
        }

        const shippingFee = Number(context.shipping_cost) || 0;
        if (shippingFee > 0) {
            summaryText += `\n*Envío:* $${shippingFee}`;
        }

        summaryText += `\n\n*TOTAL: $${total + shippingFee}*`;
        summaryText += `\n\n¿El pedido es correcto o te gustaría sumar algo más?\n`;

        // 3. Build a dynamic numbered menu based on available categories
        const { supabase: sb } = require('../../config/database');
        const { data: categories } = await sb
            .from('catalog_items')
            .select('category')
            .eq('is_active', true);
        
        const availableCategories = new Set(
            (categories || []).map((c: any) => (c.category || '').toLowerCase().trim())
        );

        const hasBebidas = availableCategories.has('bebidas') || availableCategories.has('bebida');
        const hasPostres = availableCategories.has('postres') || availableCategories.has('postre');

        const buttons: any[] = [
            { type: 'reply', reply: { id: 'confirmed', title: '✅ Todo Correcto' } }
        ];

        if (hasBebidas || hasPostres) {
            buttons.push({ type: 'reply', reply: { id: 'add_more', title: '➕ Agregar algo' } });
        } else {
            buttons.push({ type: 'reply', reply: { id: 'add_more', title: '🛒 Ver Menú' } });
        }
        
        buttons.push({ type: 'reply', reply: { id: 'cancel', title: '❌ Cancelar' } });

        const interactive = {
            type: 'button',
            body: { text: summaryText },
            footer: { text: 'Respondé tocando un botón' },
            action: { buttons }
        };

        return {
            messages: [{ interactive }],
            wait_for_input: true
        };
    }

    async handleInput(input: string, data: any, context: ExecutionContext): Promise<{ 
        updatedContext?: Partial<ExecutionContext>; 
        messages?: string[]; 
        isValidInput?: boolean; 
    }> {
        console.log(`\x1b[35m[DEBUG-VALIDATOR] Input received: "${input}"\x1b[0m`);
        
        // All valid result IDs that this node's edges can route to
        const validButtonIds = ['confirmed', 'add_drink', 'add_dessert', 'add_more', 'cancel'];
        
        const cleanInput = input.trim().toLowerCase();
        
        // 1. Direct button ID match (from WhatsApp interactive button clicks)
        let selectedId = validButtonIds.includes(cleanInput) ? cleanInput : null;
        
        // 2. Numeric fallback (when user types a number instead of pressing button)
        if (!selectedId) {
            // Build dynamic numbered options matching what was actually sent to the user
            const { supabase: sb } = require('../../config/database');
            const { data: categories } = await sb
                .from('catalog_items')
                .select('category')
                .eq('is_active', true);
            
            const availableCategories = new Set(
                (categories || []).map((c: any) => (c.category || '').toLowerCase().trim())
            );
            const hasBebidas = availableCategories.has('bebidas') || availableCategories.has('bebida');
            const hasPostres = availableCategories.has('postres') || availableCategories.has('postre');

            // Match the EXACT order of buttons sent in execute()
            const sentButtonIds: string[] = ['confirmed'];
            if (hasBebidas || hasPostres) sentButtonIds.push('add_more');
            else sentButtonIds.push('add_more');
            sentButtonIds.push('cancel');

            const numericIdMap: Record<string, string> = {};
            sentButtonIds.forEach((id, i) => { numericIdMap[String(i + 1)] = id; });
            
            selectedId = numericIdMap[cleanInput] || null;
        }

        // 3. Synonym resolution for text replies
        if (!selectedId) {
            const confirmWords = ['si', 'sí', 'confirmar', 'correcto', 'dale', 'ok', 'listo', 'todo correcto', 'confirmo'];
            const cancelWords = ['no', 'cancelar', 'nada', 'volver'];
            const addMoreWords = ['agregar', 'sumar', 'mas', 'más', 'otro', 'bebida', 'postre', 'menu', 'menú'];
            
            if (confirmWords.some(w => cleanInput.includes(w))) selectedId = 'confirmed';
            else if (cancelWords.some(w => cleanInput === w)) selectedId = 'cancel';
            else if (addMoreWords.some(w => cleanInput.includes(w))) selectedId = 'add_more';
        }

        console.log(`\x1b[35m[DEBUG-VALIDATOR] Resolved: "${input}" -> selectedId: "${selectedId}"\x1b[0m`);

        const updatedContext: Partial<ExecutionContext> = { 
            order_validation_result: selectedId || cleanInput 
        };

        // --- Forced Pickup Detection ---
        if (context.respuesta === '1' && !context.location_validated) {
            logger.info('[OrderValidator] Detected forced pickup. Persisting Retiro variables.');
            updatedContext.delivery_method = 'Retiro en local';
            updatedContext.envio_opcion = 'Retiro en local';
            updatedContext.tipo_entrega = 'Retiro en local';
            updatedContext.delivery_type = 'Retiro en local';
            updatedContext.location_validated = true;
            updatedContext.shipping_cost = 0;
            updatedContext.direccion = '';
            updatedContext.address = '';
            updatedContext.deliveryAddress = '';
            updatedContext.direccion_raw = '';
            updatedContext.domicilio = '';
            updatedContext.dirección = '';
            updatedContext.dirrecion = '';
            updatedContext.direccion_cliente = '';
            updatedContext.direccion_cliente_raw = '';
            updatedContext.zona_delivery = '';
        }

        return {
            updatedContext,
            isValidInput: !!selectedId
        };
    }
}
