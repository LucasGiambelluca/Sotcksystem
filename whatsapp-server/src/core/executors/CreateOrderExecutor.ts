import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class CreateOrderExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        let items = Array.isArray(context.order_items) ? context.order_items : [];
        let total = items.reduce((sum: number, i: any) => sum + ((i.price || 0) * (i.qty || i.quantity || 1)), 0);
        let pushName = context.pushName;
        const { supabase } = require('../../config/database');
        const { LocationService } = require('../../services/LocationService');
        
        // V2: Process Draft Orders automatically
        if (context.draft_order_id) {
            const { data: draftOrder } = await supabase.from('draft_orders').select('*').eq('id', context.draft_order_id).single();
            if (draftOrder && draftOrder.items) {
                 items = Array.isArray(draftOrder.items) ? draftOrder.items : [];
                 total = draftOrder.total;
                 pushName = draftOrder.push_name || pushName;
                 
                 // Strict Stock Re-Validation for Catalog V2
                 const { productService } = require('../../services/ProductService');
                 for (const item of items) {
                     const product = await productService.findProduct(item.catalog_item_id || item.product_id || item.product);
                     if (!product) {
                         return { messages: [`❌ El producto ${item.name} ya no está disponible.`], wait_for_input: false };
                     }
                     if (product.stock < item.qty && !product.auto_refill) {
                         return { messages: [`⚠️ Perdón, nos quedamos sin stock de ${item.name} (Quedan ${product.stock}).\n\nPor favor, escribí *menú* para empezar un nuevo pedido con el stock actualizado.`], wait_for_input: false };
                     }
                 }
                 
                 // Mark draft as converted
                 await supabase.from('draft_orders').update({ status: 'converted' }).eq('id', context.draft_order_id);
            }
        }
        
        // Extract address - try multiple possible variable names and typos
        const address = context.direccion || context.dirección || context.address || context.delivery_address || context.domicilio || context.dirrecion || context.respuesta || null;
        const deliveryType = context.tipo_entrega || context.delivery_type || context.respuesta_envio || context.delivery_method || null;
        
        // Extract delivery date
        const deliveryDate = context.fecha_entrega || context.fecha || context.date || context.delivery_date || null;
        
        console.log('[CreateOrderExecutor] Context keys:', Object.keys(context));
        console.log('[CreateOrderExecutor] Address:', address, '| Delivery type:', deliveryType, '| Date:', deliveryDate);

        // --- Módulo LIV (Logística Inteligente y Verificación) ---
        let shippingCost = 0;
        let distanceKm = null;
        let isHighRisk = false;
        let riskFlags: string[] = [];
        let finalAddressString = address;

        try {
            // Anti-Fraude: Validación de Prefijo (Bahía Blanca +549291)
            const cleanPhone = context.phone.replace(/\D/g, '');
            if (!cleanPhone.startsWith('549291') && !cleanPhone.startsWith('54291')) {
                isHighRisk = true;
                riskFlags.push('Prefijo telefónico no local (Alto Riesgo)');
            }

            const isDelivery = deliveryType?.toLowerCase().includes('delivery') || deliveryType?.toLowerCase().includes('env');

            if (isDelivery) {
                // Leer config y zonas
                const { data: config } = await supabase.from('whatsapp_config').select('store_lat, store_lng, shipping_policy').maybeSingle();
                const { data: zones } = await supabase.from('shipping_zones').select('*').eq('is_active', true);

                if (config && zones && zones.length > 0) {
                    const storeLoc = (config.store_lat && config.store_lng) ? { lat: config.store_lat, lng: config.store_lng } : undefined;
                    
                    // Buscar coordenadas GPS en el contexto (inyectadas por WhatsAppClient + FlowEngine)
                    let clientLoc = undefined;
                    const latKey = Object.keys(context).find(k => k.endsWith('_lat'));
                    const lngKey = Object.keys(context).find(k => k.endsWith('_lng'));
                    
                    if (latKey && lngKey && context[latKey] && context[lngKey]) {
                        clientLoc = { lat: parseFloat(context[latKey]), lng: parseFloat(context[lngKey]) };
                    }
                    
                    // Encontrar Zona
                    const locResult = LocationService.determineShippingZone(zones, clientLoc, storeLoc, address);
                    
                    if (locResult.zone) {
                        shippingCost = locResult.zone.cost;
                        distanceKm = locResult.distance_km;
                        total += shippingCost;
                        
                        if (clientLoc) {
                            finalAddressString = `📍 GPS (${distanceKm?.toFixed(1)}km): ` + (address ? `"${address}"` : locResult.zone.name);
                        } else {
                            finalAddressString = `🗺️ Zona: ${locResult.zone.name} (${address || 'Sin detalles'})`;
                        }
                        
                        // Si era modo SMART y mandó texto, agregar posible fee de validación si configurado en zona
                        if (!clientLoc && config.shipping_policy === 'smart') {
                            riskFlags.push('Validación manual de dirección');
                        }
                    } else if (locResult.error) {
                        return { messages: [`❌ Lo sentimos: ${locResult.error}`], wait_for_input: false };
                    }
                }
            }
        } catch(livError) {
            console.error('[LIV] Error en módulo logístico:', livError);
        }
        // --------------------------------------------------------

        try {
            console.log('[CreateOrderExecutor] DEBUG: engine exists?', !!engine);
            console.log('[CreateOrderExecutor] DEBUG: engine.orderService exists?', !!engine?.orderService);
            
            if (!engine?.orderService) {
                console.error('[CreateOrderExecutor] CRITICAL: orderService is missing from engine!');
                throw new Error("Internal Service Error: OrderService not initialized in Engine.");
            }

            const order = await engine.orderService.createOrder({
                phone: context.phone,
                items: items,
                total: total,
                deliverySlotId: context.selected_slot_id,
                address: address,
                deliveryDate: deliveryDate,
                paymentMethod: context.metodo_pago || context.payment_method,
                deliveryType: (deliveryType?.toLowerCase().includes('retiro') || deliveryType?.toLowerCase().includes('local')) ? 'PICKUP' : (deliveryType || 'DELIVERY'),
                status: 'PENDING',
                pushName: pushName,
                chatContext: { 
                    ...context, 
                    delivery_date: deliveryDate, 
                    delivery_type: deliveryType,
                    liv: {
                        shipping_cost: shippingCost,
                        distance_km: distanceKm,
                        is_high_risk: isHighRisk,
                        risk_flags: riskFlags
                    }
                }
            });

            // Registrar lat/lng del delivery si existen
            const latKey = Object.keys(context).find(k => k.endsWith('_lat'));
            const lngKey = Object.keys(context).find(k => k.endsWith('_lng'));
            if (latKey && lngKey && context[latKey] && context[lngKey]) {
                await supabase.from('orders').update({
                    delivery_lat: context[latKey],
                    delivery_lng: context[lngKey],
                    delivery_address: finalAddressString
                }).eq('id', order.id);
            } else if (finalAddressString !== address) {
                await supabase.from('orders').update({ delivery_address: finalAddressString }).eq('id', order.id);
            }

            // Auto-asignación desactivada para permitir confirmación manual vía Modal de Alerta
            // await engine.orderService.autoAssignOrder(order.id);

            // Fetch custom checkout message from config
            
            const { data: config } = await supabase.from('whatsapp_config').select('checkout_message').limit(1).single();
            const checkoutMessage = config?.checkout_message?.trim() || 'El pedido ya fue enviado a cocina.';


            const isDelivery = deliveryType?.toLowerCase().includes('delivery') || deliveryType?.toLowerCase().includes('env');
            
            const replyMessages: any[] = [
                { text: `✅ *¡Pedido confirmado!*` },
                { text: `Orden: #${order.order_number}` },
                { text: `Total: *$${total}* ${shippingCost > 0 ? `(Incluye $${shippingCost} de envío)` : ''}` },
                { text: `Destino: ${finalAddressString || (isDelivery ? 'Envío a domicilio' : 'Retiro en local')}` }
            ];

            if (checkoutMessage) {
                replyMessages.push({ text: checkoutMessage });
            }

            return { 
                messages: replyMessages,
                updatedContext: {
                    created_order: order
                },
                wait_for_input: false
            };
        } catch (err: any) {
            return { 
                messages: [`❌ Error al crear el pedido: ${err.message}`],
                wait_for_input: false
            };
        }
    }
}
