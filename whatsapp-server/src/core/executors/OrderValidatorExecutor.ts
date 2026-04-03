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
                .select('items, total')
                .eq('id', context.draft_order_id)
                .single();
            
            if (draftOrder && draftOrder.items) {
                items = draftOrder.items;
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
            summaryText += `• ${qty}x ${item.name} — $${lineTotal}\n`;
            if (item.notes) summaryText += `  _(Notas: ${item.notes})_\n`;
        }

        summaryText += `\n*TOTAL: $${total}*`;
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

        const options: { id: string; text: string }[] = [
            { id: 'confirmed', text: '✅ Todo Correcto' },
        ];
        if (hasBebidas) options.push({ id: 'add_drink', text: '🥤 Agregar Bebida' });
        if (hasPostres) options.push({ id: 'add_dessert', text: '🍰 Agregar Postre' });
        options.push({ id: 'add_more', text: '🛒 Sumar otros productos' });
        options.push({ id: 'cancel', text: '❌ Cancelar/Reiniciar' });

        const optionLines = options.map((opt, i) => `*${i + 1}.* ${opt.text}`).join('\n');
        const menuText = `${summaryText}\n${optionLines}\n\n_Respondé con el número de tu elección._`;

        return {
            messages: [menuText],
            wait_for_input: true
        };
    }

    async handleInput(input: string, data: any, context: ExecutionContext): Promise<{ 
        updatedContext?: Partial<ExecutionContext>; 
        messages?: string[]; 
        isValidInput?: boolean; 
    }> {
        // Rebuild the same dynamic options list to get correct number -> id mapping
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

        const optionIds: string[] = ['confirmed'];
        if (hasBebidas) optionIds.push('add_drink');
        if (hasPostres) optionIds.push('add_dessert');
        optionIds.push('add_more');
        optionIds.push('cancel');

        const optionIdMap: Record<string, string> = {};
        optionIds.forEach((id, i) => { optionIdMap[String(i + 1)] = id; });
        
        const selectedId = optionIdMap[input.trim()] || input.trim().toLowerCase();
        
        const updatedContext: Partial<ExecutionContext> = { 
            order_validation_result: selectedId 
        };

        // --- Forced Pickup Detection ---
        if (context.respuesta === '1' && !context.location_validated) {
            logger.info('[OrderValidator] Detected forced pickup. Persisting Retiro variables.');
            updatedContext.delivery_method = 'Retiro en local';
            updatedContext.envio_opcion = 'Retiro en local';
            updatedContext.tipo_entrega = 'Retiro en local';
            updatedContext.delivery_type = 'Retiro en local';
            updatedContext.location_validated = true;
        }

        return {
            updatedContext,
            isValidInput: !!optionIdMap[input.trim()]
        };
    }
}
