import { Request, Response } from 'express';
import { supabase } from '../../config/database';
import { officialWhatsAppClient } from '../../infrastructure/whatsapp/OfficialWhatsAppClient';
import orderService from '../../services/OrderService';
import { logger } from '../../utils/logger';

export class PublicOrderController {
    static async submitOrder(req: Request, res: Response) {
        const { 
            customerName, 
            phone, 
            deliveryMethod, 
            address, 
            paymentMethod, 
            items, 
            total 
        } = req.body;

        if (!customerName || !phone || !items || !items.length) {
            return res.status(400).json({ error: 'Faltan datos obligatorios del pedido.' });
        }

        try {
            logger.info(`[PublicOrder] Nuevo pedido de ${customerName} (${phone})`);

            // 1. Calculate Shipping Fee if it's Delivery
            let shippingFee = 0;
            let distanceKm = null;
            let deliveryAddressFull = address || 'Retiro en Local';
            if (deliveryMethod === 'Delivery' && address) {
                const { data: config } = await supabase.from('whatsapp_config').select('store_lat, store_lng').maybeSingle();
                const { data: zones } = await supabase.from('shipping_zones').select('*').eq('is_active', true);
                
                const storeLoc = config?.store_lat ? { lat: config.store_lat, lng: config.store_lng } : undefined;
                const LocationService = require('../../services/LocationService').LocationService;
                
                const locResult = await LocationService.determineShippingZone(zones || [], undefined, storeLoc, address);
                logger.info(`[PublicOrder] Resultado shipping: zone=${locResult.zone?.name}, dist=${locResult.distance_km}km, allowed=${locResult.allowed}`);
                
                if (locResult.allowed && locResult.zone) {
                    shippingFee = locResult.zone.cost;
                    distanceKm = locResult.distance_km;
                    deliveryAddressFull = address;
                } else {
                    logger.warn(`[PublicOrder] Pedido NO permitido para envío o sin zona: ${locResult.error || 'Sin zona'}`);
                }
            }

            const totalWithShipping = total + shippingFee;

            // Normalize phone: Ensure it has 549 for Argentina if it's a 10-digit number
            let normalizedPhone = phone.replace(/\D/g, '');
            if (normalizedPhone.length === 10) {
                normalizedPhone = '549' + normalizedPhone;
            } else if (normalizedPhone.length === 11 && normalizedPhone.startsWith('291')) {
                normalizedPhone = '549' + normalizedPhone;
            }

            // Adapt items for OrderService format
            const formattedItems = items.map((it: any) => ({
                catalog_item_id: it.product.id,
                qty: it.quantity,
                price: it.product.is_special && it.product.special_price ? it.product.special_price : it.product.price,
                name: it.product.name
            }));

            // Use OrderService for robust creation (handles clients, stock, etc.)
            const order = await orderService.createOrder({
                phone: normalizedPhone,
                items: formattedItems,
                total: totalWithShipping,
                deliveryFee: shippingFee,
                address: deliveryAddressFull,
                paymentMethod,
                deliveryType: deliveryMethod === 'Delivery' ? 'DELIVERY' : 'PICKUP',
                pushName: customerName,
                status: 'PENDING',
                chatContext: { channel: 'WEB_CATALOG', customerName, distance_km: distanceKm }
            });

            // 3. Format WhatsApp Message for the Business
            const fmt = (n: number) => `$${n.toLocaleString('es-AR')}`;
            const blocks = distanceKm ? Math.round(distanceKm * 10) : null;

            const messageLines = [
                `*¡NUEVO PEDIDO WEB!*`,
                `--------------------------`,
                `*Cliente:* ${customerName}`,
                `*Teléfono:* ${phone}`,
                `*Tipo:* ${deliveryMethod}`,
                deliveryMethod === 'Delivery' ? `*Dir:* ${address}` : '',
                blocks ? `*Distancia:* ~${blocks} cuadras` : '',
                `*Pago:* ${paymentMethod}`,
                `--------------------------`,
                `*Productos:*`,
                ...items.map((it: any) => `• ${it.product.name} x${it.quantity}`),
                `--------------------------`,
                `*Subtotal:* ${fmt(total)}`,
                shippingFee > 0 ? `*Envío:* ${fmt(shippingFee)}` : '',
                `*TOTAL: ${fmt(totalWithShipping)}*`,
                `--------------------------`
            ].filter(Boolean);

            const businessPhone = process.env.BUSINESS_PHONE || '5492915093499';
            await officialWhatsAppClient.sendMessage(businessPhone, messageLines.join('\n'));

            return res.json({ 
                success: true, 
                orderId: order.id, 
                orderNumber: order.order_number 
            });

        } catch (error: any) {
            logger.error('[PublicOrder] Error al procesar pedido direct:', error);
            return res.status(500).json({ error: error.message || 'Error interno al procesar el pedido.' });
        }
    }

    static async calculateShipping(req: Request, res: Response) {
        const { address } = req.body;
        if (!address || address.length < 5) {
            return res.status(400).json({ error: 'Dirección inválida' });
        }

        try {
            const { data: config } = await supabase.from('whatsapp_config').select('store_lat, store_lng').maybeSingle();
            const { data: zones } = await supabase.from('shipping_zones').select('*').eq('is_active', true);
            
            const storeLoc = config?.store_lat ? { lat: config.store_lat, lng: config.store_lng } : undefined;
            const LocationService = require('../../services/LocationService').LocationService;
            
            const locResult = await LocationService.determineShippingZone(zones || [], undefined, storeLoc, address);
            
            if (locResult.allowed && locResult.zone) {
                const distanceKm = locResult.distance_km;
                const blocks = distanceKm ? Math.round(distanceKm * 10) : null;
                return res.json({ 
                    success: true, 
                    fee: locResult.zone.cost, 
                    distanceKm, 
                    blocks,
                    zoneName: locResult.zone.name
                });
            } else {
                return res.json({ 
                    success: false, 
                    error: locResult.error || 'Fuera de zona de entrega' 
                });
            }
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }
}
