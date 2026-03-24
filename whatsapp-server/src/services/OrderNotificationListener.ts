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

  OUT_FOR_DELIVERY: `🛵 *¡Tu pedido ya salió!*
  
Hola {clientName}! El repartidor ya está en camino con tu pedido.

📦 Pedido: #{orderId}
{deliveryAddress}

¡Preparate para recibirlo! 🎉`,

  PICKED_UP: `🛵 *¡Pedido Retirado!*

Hola {clientName}! El repartidor ya retiró tu pedido y pronto saldrá para allá.`,

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
  private processedChanges: Map<string, string> = new Map(); // orderId -> status to prevent duplicates

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
          console.log(`\n========================================`);
          console.log(`[OrderNotificationListener] Received Realtime UPDATE:`, JSON.stringify(payload));
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;

          console.log(`[OrderNotificationListener] Parsed statuses -> old: ${oldStatus}, new: ${newStatus}`);

          const lastProcessed = this.processedChanges.get(payload.new?.id);
          if (lastProcessed === newStatus) {
            console.log(`[OrderNotificationListener] Skipping (Already processed status ${newStatus} for order ${payload.new?.id})`);
            return;
          }

          if (oldStatus !== newStatus && newStatus && newStatus !== 'PENDING') {
            console.log(`🔔 [OrderNotificationListener] Triggering handleStatusChange: ${oldStatus} -> ${newStatus} for order ${payload.new?.id}`);
            this.processedChanges.set(payload.new?.id, newStatus);
            
            // Clean up cache to prevent memory leaks (keep last 500 orders)
            if (this.processedChanges.size > 500) {
              const firstKey = this.processedChanges.keys().next().value;
              if (firstKey) this.processedChanges.delete(firstKey);
            }

            await this.handleStatusChange(payload.new?.id, newStatus);
          } else {
            console.log(`[OrderNotificationListener] Skipping handleStatusChange (No change, null status or PENDING).`);
          }
          console.log(`========================================\n`);
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
        console.error(`❌ [OrderNotificationListener] Error fetching order ${orderId} details:`, orderError);
        return;
      }

      console.log(`[OrderNotificationListener] Processing status "${newStatus}" for order #${order.id.slice(0,8)}...`);

      const phone = order.phone || order.client?.phone;
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
        case 'OUT_FOR_DELIVERY':
          if (order.delivery_type === 'PICKUP' || !order.delivery_address) {
            template = waConfig?.template_ready || DEFAULT_TEMPLATES.READY_FOR_PICKUP;
          } else {
            template = waConfig?.template_out_delivery || DEFAULT_TEMPLATES.OUT_FOR_DELIVERY;
          }
          break;
        case 'PICKED_UP':
          template = waConfig?.template_picked_up || DEFAULT_TEMPLATES.PICKED_UP;
          console.log(`🛵 [OrderNotificationListener] Order #${order.id.slice(0,8)} marked as PICKED_UP.`);
          break;
        case 'DELIVERED':
          template = waConfig?.template_delivered || DEFAULT_TEMPLATES.DELIVERED;
          
          // Internal notification for the owner
          await this.createInternalNotification(order);
          break;
        case 'CANCELLED':
          template = waConfig?.template_cancelled || DEFAULT_TEMPLATES.CANCELLED;
          break;
        case 'READY_FOR_PICKUP':
        case 'READY':
          template = waConfig?.template_ready || DEFAULT_TEMPLATES.READY_FOR_PICKUP;
          break;
      }

      console.log(`[OrderNotificationListener] Selected template:`, !!template ? "Found" : "NOT FOUND");

      if (!template) {
         console.log(`⚠️ [OrderNotificationListener] No template found for status: ${newStatus}`);
         return;
      }

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

  private async createInternalNotification(order: any) {
    try {
      console.log(`🔔 [OrderNotificationListener] Creating internal notification for owner...`);
      await supabase.from('notifications').insert({
        title: '✅ Entrega Confirmada',
        message: `El pedido #${order.order_number || order.id.slice(0, 8)} de ${order.client?.name || order.phone} ha sido entregado por el cadete.`,
        type: 'DELIVERY_CONFIRMED',
        metadata: { orderId: order.id, orderNumber: order.order_number },
        read: false
      });
    } catch (err) {
      console.error('❌ [OrderNotificationListener] Error creating internal notification:', err);
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
