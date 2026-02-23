import { supabase } from '../supabaseClient';
import { sendWhatsAppMessage } from './whatsappService';
import type { OrderStatus } from '../types';

interface OrderNotificationData {
  orderId: string;
  clientName: string;
  clientPhone: string;
  total: number;
  deliveryDate?: string;
  deliveryAddress?: string;
}

const DEFAULT_TEMPLATES: Record<OrderStatus, string> = {
  PENDING: '',
  CONFIRMED: `✅ *Pedido Confirmado*

Hola {clientName}! Tu pedido ha sido confirmado.

📦 Pedido: #{orderId}
💰 Total: \${total}
{deliveryDate}

Te avisaremos cuando comencemos a prepararlo.`,

  IN_PREPARATION: `👨‍🍳 *Pedido en Preparación*

Hola {clientName}! Estamos preparando tu pedido.

📦 Pedido: #{orderId}
⏱️ Tiempo estimado: 30-45 min

Te avisaremos cuando salga para entrega.`,

  IN_TRANSIT: `🚚 *Pedido en Camino*

Hola {clientName}! Tu pedido está en camino.

📦 Pedido: #{orderId}
{deliveryAddress}

¡Pronto estaremos ahí!`,

  DELIVERED: `✅ *Pedido Entregado*

Hola {clientName}! Tu pedido ha sido entregado.

📦 Pedido: #{orderId}
💰 Total: \${total}

¡Gracias por tu compra! 🎉`,

  CANCELLED: `❌ *Pedido Cancelado*

Hola {clientName}, lamentamos informarte que tu pedido ha sido cancelado.

📦 Pedido: #{orderId}

Si tenés alguna consulta, no dudes en contactarnos.`
};

function formatMessage(template: string, data: OrderNotificationData): string {
  let message = template;
  message = message.replace(/{clientName}/g, data.clientName);
  message = message.replace(/{orderId}/g, data.orderId.slice(0, 8));
  message = message.replace(/{total}/g, data.total.toFixed(2));
  
  // Conditional replacements
  const dateStr = data.deliveryDate ? `📅 Entrega: ${new Date(data.deliveryDate).toLocaleDateString('es-AR')}` : '';
  message = message.replace(/{deliveryDate}/g, dateStr);

  const addressStr = data.deliveryAddress ? `📍 Dirección: ${data.deliveryAddress}` : '';
  message = message.replace(/{deliveryAddress}/g, addressStr);

  return message;
}

export async function sendOrderStatusNotification(
  orderId: string,
  newStatus: OrderStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    // Skip notification for PENDING status
    if (newStatus === 'PENDING') {
      return { success: true };
    }

    // 1. Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, client:clients(*)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Error fetching order for notification:', orderError);
      return { success: false, error: 'Order not found' };
    }

    // 2. Check phone
    const phone = order.client?.phone;
    if (!phone) {
      console.log('No phone number for order', orderId, '- skipping notification');
      return { success: true };
    }

    // 3. Fetch WhatsApp Config & Templates
    const { data: waConfig } = await supabase
      .from('whatsapp_config')
      .select('*')
      .single();

    // 4. Select Template
    let template = '';
    
    // Try to get from DB, fallback to default
    switch (newStatus) {
        case 'CONFIRMED':
            template = waConfig?.template_confirmed || DEFAULT_TEMPLATES.CONFIRMED;
            break;
        case 'IN_PREPARATION':
            template = waConfig?.template_preparation || DEFAULT_TEMPLATES.IN_PREPARATION;
            break;
        case 'IN_TRANSIT':
            template = waConfig?.template_transit || DEFAULT_TEMPLATES.IN_TRANSIT;
            break;
        case 'DELIVERED':
            template = waConfig?.template_delivered || DEFAULT_TEMPLATES.DELIVERED;
            break;
        case 'CANCELLED':
            template = waConfig?.template_cancelled || DEFAULT_TEMPLATES.CANCELLED;
            break;
        default:
            return { success: true };
    }

    if (!template) return { success: true };

    // 5. Format Message
    const notificationData: OrderNotificationData = {
      orderId: order.id,
      clientName: order.client?.name || 'Cliente',
      clientPhone: phone,
      total: order.total_amount,
      deliveryDate: order.delivery_date || undefined,
      deliveryAddress: order.delivery_address || undefined,
    };

    const message = formatMessage(template, notificationData);

    // 6. Send
    await sendWhatsAppMessage(phone, message);
    return { success: true };

  } catch (error) {
    console.error('Error sending order notification:', error);
    return { success: false, error: 'Internal error' };
  }
}
