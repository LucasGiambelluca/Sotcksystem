import { supabase } from '../config/database';
import { whatsappClient } from '../infrastructure/whatsapp/WhatsAppClient';

interface OrderNotificationData {
  orderId: string;
  clientName: string;
  clientPhone: string;
  total: number;
  deliveryDate?: string;
  deliveryAddress?: string;
}

const DEFAULT_TEMPLATES: Record<string, string> = {
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

Si tenés alguna consulta, no dudes en contactarnos.`,

  READY_FOR_PICKUP: `🍕 *¡Pedido Listo!*

¡Hola {clientName}! Tu pedido ya está listo para ser retirado.

📦 Pedido: #{orderId}
🏬 Podés venir a buscarlo al local ahora mismo.

¡Te esperamos! 🍗`
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

export class OrderNotificationListener {
  private static instance: OrderNotificationListener;
  private channel: any = null;

  private constructor() {}

  public static getInstance(): OrderNotificationListener {
    if (!OrderNotificationListener.instance) {
      OrderNotificationListener.instance = new OrderNotificationListener();
    }
    return OrderNotificationListener.instance;
  }

  public start() {
    console.log('📡 [OrderNotificationListener] Starting Realtime listener...');
    
    this.channel = supabase
      .channel('order-status-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        async (payload) => {
          const oldStatus = payload.old.status;
          const newStatus = payload.new.status;

          if (oldStatus !== newStatus && newStatus !== 'PENDING') {
            console.log(`🔔 [OrderNotificationListener] Status changed: ${oldStatus} -> ${newStatus} for order ${payload.new.id}`);
            await this.handleStatusChange(payload.new.id, newStatus);
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 [OrderNotificationListener] Subscription status: ${status}`);
      });
  }

  private async handleStatusChange(orderId: string, newStatus: string) {
    try {
      // 1. Fetch order details with client info
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, client:clients(*)')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        console.error('❌ [OrderNotificationListener] Error fetching order details:', orderError);
        return;
      }

      const phone = order.client?.phone;
      if (!phone) {
        console.log(`⚠️ [OrderNotificationListener] No phone for order ${orderId}, skipping.`);
        return;
      }

      // 2. Fetch WhatsApp Config for templates
      const { data: waConfig } = await supabase
        .from('whatsapp_config')
        .select('*')
        .single();

      // 3. Select Template
      let template = '';
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
        case 'READY_FOR_PICKUP':
        case 'READY': // Handle both possible names from UI
          template = waConfig?.template_ready || DEFAULT_TEMPLATES.READY_FOR_PICKUP;
          break;
      }

      if (!template) return;

      // 4. Format Message
      const notificationData: OrderNotificationData = {
        orderId: order.id,
        clientName: order.client?.name || 'Cliente',
        clientPhone: phone,
        total: order.total_amount,
        deliveryDate: order.delivery_date || undefined,
        deliveryAddress: order.delivery_address || undefined,
      };

      const message = formatMessage(template, notificationData);

      // 5. Send via WhatsApp
      console.log(`📤 [OrderNotificationListener] Sending notification to ${phone}...`);
      await whatsappClient.sendMessage(phone, { text: message });
      console.log(`✅ [OrderNotificationListener] Notification sent for order ${orderId}`);

    } catch (err) {
      console.error('❌ [OrderNotificationListener] Fatal error:', err);
    }
  }

  public stop() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}

export const orderNotificationListener = OrderNotificationListener.getInstance();
