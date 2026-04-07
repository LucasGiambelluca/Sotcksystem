import { supabase } from '../config/database';
import { whatsappClient } from '../infrastructure/whatsapp/WhatsAppClient';
import { ConfigurationService } from './ConfigurationService';
import { logger } from '../utils/logger';

interface OrderNotificationData {
  orderId: string;
  clientName: string;
  clientPhone: string;
  total: number;
  deliveryFee?: number;
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

  PICKED_UP: `🛵 *¡Tu pedido está en camino!*
  
Hola {clientName}! El cadete ya tiene tu pedido y está yendo a tu dirección. ¡Preparate para recibirlo! 🔔`,

  DELIVERED: `✅ *Pedido Entregado*

Hola {clientName}! Tu pedido ha sido entregado.

📦 Pedido: #{orderId}
💰 {breakdown}

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
  
  const totalVal = data.total || 0;
  const feeVal = data.deliveryFee || 0;
  const subtotalVal = totalVal - feeVal;

  message = message.replace(/{total}/g, totalVal.toFixed(2));
  message = message.replace(/{deliveryFee}/g, feeVal.toFixed(2));
  message = message.replace(/{subtotal}/g, subtotalVal.toFixed(2));
  
  // Breakdown specific replacement
  const breakdown = feeVal > 0 
    ? `Subtotal: $${subtotalVal.toFixed(2)}\nEnvío: $${feeVal.toFixed(2)}\nTotal: *$${totalVal.toFixed(2)}*`
    : `Total: *$${totalVal.toFixed(2)}*`;
  
  message = message.replace(/{breakdown}/g, breakdown);
  
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
  private processedNewOrders: Set<string> = new Set(); // orderId -> handled for typing

  private constructor() {}

  public static getInstance(): OrderNotificationListener {
    if (!OrderNotificationListener.instance) {
      OrderNotificationListener.instance = new OrderNotificationListener();
    }
    return OrderNotificationListener.instance;
  }

  public start() {
    logger.info('📡 [OrderNotificationListener] Starting Realtime listener... (V-ROBUST-1)');
    
    // Generamos un nombre único para evitar sesiones "trabadas"
    const channelName = `order-status-notifications-${Date.now()}`;
    logger.info(`📡 [OrderNotificationListener] Intentando conectar al canal: ${channelName}`);

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

          logger.info(`\n🔔 [OrderNotificationListener] EVENTO: ${eventType} | Pedido: ${orderId} | Canal: ${channel}`);
          
          if (eventType === 'INSERT') {
            if (this.processedNewOrders.has(orderId)) {
                logger.info(`⏩ [OrderNotificationListener] Pedido #${orderId.slice(0,8)} ya procesado por polling. Saltando.`);
                return;
            }
            this.processedNewOrders.add(orderId);

            logger.info(`🆕 [OrderNotificationListener] NUEVA ORDEN DETECTADA! ID: ${orderId}, Canal: ${channel}`);
            
            // 1. Auto Print
            await this.triggerAutoPrint(orderId, channel);

            // 2. Auto Accept
            const appConfig = await ConfigurationService.getFullConfig();
            if (appConfig.auto_accept_orders) {
                // Pequeño delay de gracia para asegurar que el INSERT de la orden se haya completado en DB
                // y evitar conflictos de versión en Supabase.
                await new Promise(res => setTimeout(res, 500));
                
                logger.info(`🤖 [OrderNotificationListener] Auto-aceptando pedido #${orderId.slice(0,8)}`);
                const { error: updateError } = await supabase.from('orders').update({ 
                    status: 'IN_PREPARATION'
                }).eq('id', orderId);

                if (updateError) {
                    logger.error(`❌ [OrderNotificationListener] Error en auto-aceptación de #${orderId.slice(0,8)}:`, updateError);
                } else {
                    logger.info(`✅ [OrderNotificationListener] Estado actualizado a IN_PREPARATION para #${orderId.slice(0,8)}`);
                }
            }
          }
 else if (eventType === 'UPDATE') {
            await this.handleStatusChange(orderId, (payload.new as any)?.status);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          logger.info(`📡 [OrderNotificationListener] Successfully subscribed to orders changes.`);
        } else {
          logger.warn(`⚠️ [OrderNotificationListener] Subscription status: ${status}. Usando POLLING como respaldo.`);
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
                .select('id, status, created_at')
                .gt('created_at', lookback)
                .not('status', 'eq', 'PENDING');

            if (recentOrders && recentOrders.length > 0) {
                for (const order of recentOrders) {
                    const lastProcessed = this.processedChanges.get(order.id);
                    if (lastProcessed !== order.status) {
                        logger.info(`[OrderPolling] Detectado cambio vía polling para ${order.id}: ${order.status}`);
                        this.processedChanges.set(order.id, order.status);
                        await this.handleStatusChange(order.id, order.status);
                    }
                }
            }
        } catch (e) {
            logger.error('[OrderPolling] Error:', e);
        }
    }, 2000); // 2 seconds for near-realtime feedback

    // POLLING FALLBACK PARA NUEVAS ORDENES (si falla Realtime INSERT)
    setInterval(async () => {
        try {
            const windowMs = 300000; // 5 minutos
            const lookback = new Date(Date.now() - windowMs).toISOString();
            const { data: newOrders } = await supabase
                .from('orders')
                .select('id, channel, status')
                .eq('status', 'PENDING')
                .gt('created_at', lookback);

            if (newOrders && newOrders.length > 0) {
                for (const order of newOrders) {
                    if (!this.processedNewOrders.has(order.id)) {
                        logger.info(`[INSERT-Polling] Detectada nueva orden no procesada: ${order.id} (${order.channel})`);
                        this.processedNewOrders.add(order.id);
                        
                        // 1. Auto Print
                        await this.triggerAutoPrint(order.id, order.channel);

                        // 2. Auto Accept
                        const appConfig = await ConfigurationService.getFullConfig();
                        if (appConfig.auto_accept_orders) {
                            logger.info(`🤖 [INSERT-Polling] Auto-aceptando pedido #${order.id.slice(0,8)}`);
                            await supabase.from('orders').update({ status: 'IN_PREPARATION' }).eq('id', order.id);
                        }
                    }
                }
            }
        } catch (e) {
            logger.error('[INSERT-Polling] Error:', e);
        }
    }, 10000); // Cada 10 segundos
  }

  private async triggerAutoPrint(orderId: string, channel: string) {
    logger.info(`🖨️ [OrderNotificationListener] Iniciando trigger de impresión para #${orderId.slice(0,8)} (Canal: ${channel})`);
    
    // ESPERAR un momento para que los items lleguen (Race condition fix)
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        // Verificar si ya está en print_queue para evitar duplicados persistentes
        const { data: existing } = await supabase
            .from('print_queue')
            .select('id')
            .eq('order_id', orderId)
            .maybeSingle();

        if (existing) {
            logger.info(`⏩ [OrderNotificationListener] La orden #${orderId.slice(0,8)} ya existe en print_queue. Saltando.`);
            this.processedNewOrders.add(orderId);
            return;
        }

        // Check centralized config
        const appConfig = await ConfigurationService.getFullConfig();
        const { data: pCfg } = await supabase.from('printer_config').select('auto_print_enabled').limit(1).maybeSingle();
        
        const isAutoPrint = pCfg?.auto_print_enabled || appConfig.auto_print;
        logger.info(`⚙️ [OrderNotificationListener] Config Impresión: ${isAutoPrint ? 'ON' : 'OFF'}`);
            
        if (isAutoPrint) {
            const { PrinterService } = require('./PrinterService');
            const success = await PrinterService.queueOrderTicket(orderId);
            if (success) {
                logger.info(`✅ [OrderNotificationListener] Ticket encolado satisfactoriamente para #${orderId.slice(0,8)}`);
                this.processedNewOrders.add(orderId);
            } else {
                logger.warn(`❌ [OrderNotificationListener] PrinterService.queueOrderTicket retornó FALSE para #${orderId.slice(0,8)}`);
            }
        } else {
            logger.info(`⏩ [OrderNotificationListener] Auto-impresión desactivada en configuración.`);
        }
    } catch (e: any) {
        logger.error('❌ [OrderNotificationListener] Error fatal disparando impresión:', { error: e.message });
    }
  }

  private async handleStatusChange(orderId: string, newStatus: string) {
    logger.info(`🔔 [OrderNotificationListener] Received status change for #${orderId.slice(0,8)}: ${newStatus}`);
    try {
      // 1. Evitar duplicados (In-memory)
      if (this.processedChanges.get(orderId) === newStatus) {
        return;
      }

      // 2. Persistent Deduplication (Redis)
      const { DeduplicationService } = require('./DeduplicationService');
      const isDup = await DeduplicationService.isDuplicate(`wa_notif:${orderId}:${newStatus}`, 300); // 5 minute window
      if (isDup) {
        logger.info(`⏩ [OrderNotificationListener] Skipping duplicate notification (Redis) for #${orderId.slice(0,8)} | Status: ${newStatus}`);
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
      
      // Skip WhatsApp notifications for TABLET channel (In-store sales)
      if (order.channel === 'TABLET') {
        logger.info(`ℹ️ [OrderNotificationListener] Skipping WhatsApp notification for TABLET order ${orderId}`);
        return;
      }

      const phone = order.phone || order.client?.phone;
      if (!phone) {
        logger.info(`⚠️ [OrderNotificationListener] No phone for order ${orderId}, skipping.`);
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
        case 'SHIPPED': {
          // Treat transit/shipped as delivery notification, BUT check if it's a pickup
          const dtLower = (order.delivery_type || '').toLowerCase();
          const adLower = (order.delivery_address || '').toLowerCase();
          const isPickup = dtLower === 'pickup' || 
                         dtLower.includes('retiro') || 
                         dtLower.includes('local') || 
                         adLower.includes('retiro') || 
                         adLower.includes('local');
          
          if (isPickup) {
            template = waConfig?.template_ready || DEFAULT_TEMPLATES.READY_FOR_PICKUP;
          } else {
            // Wait for PICKED_UP
            return;
          }
          break;
        }
        case 'OUT_FOR_DELIVERY': {
          const dtLower = (order.delivery_type || '').toLowerCase();
          const adLower = (order.delivery_address || '').toLowerCase();
          const isPickup = dtLower === 'pickup' || 
                         dtLower.includes('retiro') || 
                         dtLower.includes('local') || 
                         adLower.includes('retiro') || 
                         adLower.includes('local');

          if (isPickup) {
            template = waConfig?.template_ready || DEFAULT_TEMPLATES.READY_FOR_PICKUP;
          } else {
            // Only send when PICKED_UP
            return;
          }
          break;
        }
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
         logger.info(`⚠️ [OrderNotificationListener] No template found for status: ${newStatus}`);
         return;
      }

      // 4. Format Message
      const notificationData: OrderNotificationData = {
        orderId: order.id,
        clientName: order.client?.name || 'Cliente',
        clientPhone: phone,
        total: order.total_amount || 0,
        deliveryFee: order.delivery_fee || 0,
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
