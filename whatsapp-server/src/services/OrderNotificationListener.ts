import { supabase } from '../config/database';
import { whatsappClient } from '../infrastructure/whatsapp/WhatsAppClient';
import { ConfigurationService } from './ConfigurationService';

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
    
    // Generamos un nombre único para evitar sesiones "trabadas"
    const channelName = `order-status-notifications-${Date.now()}`;
    console.log(`📡 [OrderNotificationListener] Intentando conectar al canal: ${channelName}`);

    this.channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // UPDATE and INSERT
          schema: 'public',
          table: 'orders',
        },
        async (payload) => {
          const orderId = (payload.new as any)?.id;
          const eventType = payload.eventType;
          const channel = (payload.new as any)?.channel;

          console.log(`\n🔔 [OrderNotificationListener] EVENTO: ${eventType} | Pedido: ${orderId} | Canal: ${channel}`);
          
          if (eventType === 'INSERT') {
            console.log(`🆕 [OrderNotificationListener] NUEVA ORDEN DETECTADA! Evaluando impresión...`);
            
            // For completely decoupled sources like the Web/Tablet dashboard,
            // we catch the INSERT event and auto-queue the print ticket
            // IF it isn't from WhatsApp (WhatsApp handles its own printing in CreateOrderExecutor)
            if (channel && channel !== 'WHATSAPP') {
                console.log(`🖨️ [OrderNotificationListener] Canal válido para auto-impresión (${channel}).`);
                try {
                    // Check centralized config
                    const appConfig = await ConfigurationService.getFullConfig();
                    const { data: pCfg } = await supabase.from('printer_config').select('auto_print_enabled').limit(1).maybeSingle();
                    
                    const isAutoPrint = pCfg?.auto_print_enabled || appConfig.auto_print;
                    console.log(`⚙️ [OrderNotificationListener] Config Impresión: ${isAutoPrint ? 'ON' : 'OFF'}`);
                        
                    if (isAutoPrint) {
                        const { PrinterService } = require('./PrinterService');
                        const success = await PrinterService.queueOrderTicket(orderId);
                        if (success) {
                            console.log(`✅ [OrderNotificationListener] Ticket encolado para #${orderId.slice(0,8)}`);
                        } else {
                            console.warn(`❌ [OrderNotificationListener] Falló PrinterService.queueOrderTicket para #${orderId.slice(0,8)}`);
                        }
                    } else {
                        console.log(`⏩ [OrderNotificationListener] Auto-impresión desactivada.`);
                    }
                } catch (e) {
                    console.error('❌ [OrderNotificationListener] Error fatal disparando impresión:', e);
                }
            } else {
                console.log(`⏩ [OrderNotificationListener] Saltando impresión (Canal WhatsApp o Desconocido: ${channel})`);
            }
          } else if (eventType === 'UPDATE') {
            await this.handleStatusChange(orderId, (payload.new as any)?.status);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`📡 [OrderNotificationListener] Successfully subscribed to orders changes.`);
        } else {
          console.warn(`⚠️ [OrderNotificationListener] Subscription status: ${status}. Usando POLLING como respaldo.`);
        }
      });

    // POLLING FALLBACK: Cada 5 segundos buscamos pedidos actualizados recientemente
    setInterval(async () => {
        try {
            // Buffer ampliado: buscamos cambios en los últimos 2 minutos para evitar gaps
            const windowMs = 120000; 
            const lookback = new Date(Date.now() - windowMs).toISOString();
            const { data: recentOrders } = await supabase
                .from('orders')
                .select('id, status, updated_at')
                .gt('updated_at', lookback)
                .not('status', 'eq', 'PENDING');

            if (recentOrders && recentOrders.length > 0) {
                for (const order of recentOrders) {
                    const lastProcessed = this.processedChanges.get(order.id);
                    if (lastProcessed !== order.status) {
                        console.log(`[OrderPolling] Detectado cambio vía polling para ${order.id}: ${order.status}`);
                        // Removed this.processedChanges.set(order.id, order.status); here
                        // to let handleStatusChange process it and avoid the early return check inside it.
                        await this.handleStatusChange(order.id, order.status);
                    }
                }
            }
        } catch (e) {
            console.error('[OrderPolling] Error:', e);
        }
    }, 30000);
  }

  private async handleStatusChange(orderId: string, newStatus: string) {
    try {
      // Evitar duplicados (Realtime vs Polling)
      if (this.processedChanges.get(orderId) === newStatus) {
        return;
      }
      this.processedChanges.set(orderId, newStatus);
      
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
      const waConfigRaw = await ConfigurationService.getFullConfig();
      // Emulate the structure expected by the original code (or refactor to use appConfig directly)
      const waConfig = {
          template_confirmed: waConfigRaw['template_confirmed' as any], 
          template_preparation: waConfigRaw['template_preparation' as any],
          template_delivered: waConfigRaw['template_delivered' as any],
          template_cancelled: waConfigRaw['template_cancelled' as any],
          template_ready: waConfigRaw['template_ready' as any],
          template_out_delivery: waConfigRaw['template_out_delivery' as any],
          template_picked_up: waConfigRaw['template_picked_up' as any]
      };

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
        case 'SHIPPED':
          // Treat transit/shipped as delivery notification
          template = waConfig?.template_out_delivery || DEFAULT_TEMPLATES.OUT_FOR_DELIVERY;
          break;
        case 'OUT_FOR_DELIVERY':
          // Ensure delivery notification is always sent even if cadet system is offline
          template = waConfig?.template_out_delivery || DEFAULT_TEMPLATES.OUT_FOR_DELIVERY;
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
        default:
          // No template for other statuses
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
