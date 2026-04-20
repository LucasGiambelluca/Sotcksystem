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
    ? `Subtotal: $${subtotalVal.toFixed(2)}\nEnvio: $${feeVal.toFixed(2)}\nTotal: *$${totalVal.toFixed(2)}*`
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
                .select('id, status, updated_at, chat_context')
                .gt('updated_at', lookback)
                .not('status', 'eq', 'PENDING');

            if (recentOrders && recentOrders.length > 0) {
                const myBotId = process.env.WHATSAPP_PHONE_NUMBER_ID;
                for (const order of recentOrders) {
                    // Isolation check
                    const orderBotId = (order.chat_context as any)?.bot_id;
                    if (orderBotId && myBotId && orderBotId !== myBotId) continue;

                    const lastProcessed = this.processedChanges.get(order.id);
                    if (lastProcessed !== order.status) {
                        logger.info(`[OrderPolling] Detectado cambio vía polling para ${order.id}: ${order.status}`);
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
            // Heartbeat check for auditing
            // logger.info('[INSERT-Polling] Rechecking pending orders...');
            
            const { data: newOrders } = await supabase
                .from('orders')
                .select('id, channel, status, chat_context')
                .eq('status', 'PENDING');

            if (newOrders && newOrders.length > 0) {
                const myBotId = process.env.WHATSAPP_PHONE_NUMBER_ID;
                const mySlug = process.env.CATALOG_SLUG; // e.g. 'eldelirio' o 'elpollocomilon'

                for (const order of newOrders) {
                    // Isolation check: Only process if it belongs to this bot
                    const orderBotId = (order.chat_context as any)?.bot_id;
                    const orderSlug = (order.chat_context as any)?.catalog_slug;
                    const orderBusiness = (order.chat_context as any)?.catalog_business_name;
                    
                    // Lógica SMART de aislamiento:
                    let isMyOrder = false;

                    // 1. Si el bot_id coincide, es mío 100%
                    if (myBotId && orderBotId && orderBotId === myBotId) {
                        isMyOrder = true;
                    } 
                    // 2. Si no hay bot_id pero el slug coincide, es mío
                    else if (mySlug && orderSlug && orderSlug === mySlug) {
                        isMyOrder = true;
                    }
                    // 3. Si no hay nada pero el nombre de negocio coincide (parcial)
                    else if (orderBusiness && mySlug && orderBusiness.toLowerCase().includes(mySlug.toLowerCase())) {
                        isMyOrder = true;
                    }
                    // 4. Si es local y no hay un bot oficial configurado, procesamos igual para pruebas
                    else if (!myBotId && !orderBotId) {
                        isMyOrder = true;
                    }

                    // Si no es mío y estamos en el VPS (myBotId existe), lo ignoramos
                    if (myBotId && !isMyOrder) continue;

                    if (!this.processedNewOrders.has(order.id)) {
                        logger.info(`[INSERT-Polling] Detectada nueva orden no procesada: ${order.id} (${order.channel})`);
                        this.processedNewOrders.add(order.id);
                        
                        // 1. Auto Print
                        await this.triggerAutoPrint(order.id, order.channel);

                        // 2. Auto Accept
                        const appConfig = await ConfigurationService.getFullConfig();
                        if (appConfig.auto_accept_orders) {
                            logger.info(`🤖 [INSERT-Polling] Auto-aceptando pedido #${order.id.slice(0,8)}`);
                            const { error: updErr } = await supabase.from('orders').update({ status: 'IN_PREPARATION' }).eq('id', order.id);
                            if (!updErr) {
                                // Forzamos el procesado de la notificación inmediatamente después de auto-aceptar
                                await this.handleStatusChange(order.id, 'IN_PREPARATION');
                            }
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

      // --- SMART MULTI-BOT PROTECTION ---
      const orderBotId = (order.chat_context as any)?.bot_id || order.metadata?.bot_id;
      const orderSlug = (order.chat_context as any)?.catalog_slug;
      const orderBusiness = (order.chat_context as any)?.catalog_business_name;
      
      const myBotId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const mySlug = process.env.CATALOG_SLUG;

      let isMyOrder = false;
      if (myBotId && orderBotId && orderBotId === myBotId) isMyOrder = true;
      else if (mySlug && orderSlug && orderSlug === mySlug) isMyOrder = true;
      else if (orderBusiness && mySlug && orderBusiness.toLowerCase().includes(mySlug.toLowerCase())) isMyOrder = true;
      else if (!myBotId && !orderBotId) isMyOrder = true; // Local dev fallback

      if (myBotId && !isMyOrder) {
          logger.info(`🚫 [OrderNotificationListener] Ignorando notificación para #${orderId.slice(0,8)}: no pertenece a mi instancia (${mySlug || myBotId})`);
          return;
      }

      if (!isMyOrder) {
          logger.warn(`⚠️ [OrderNotificationListener] Pedido #${orderId.slice(0,8)} no pudo ser validado como propio. Saltando notificación por seguridad.`);
          return;
      }
      // ----------------------------

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
          template_transit: waConfigRaw['template_transit' as any] || waConfigRaw['template_out_delivery' as any],
          template_picked_up: waConfigRaw['template_picked_up' as any],
          template_arrived: waConfigRaw['template_arrived' as any]
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
        case 'ENVIADO':
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
            // Priority: Transit template, then default
            template = waConfig?.template_transit || DEFAULT_TEMPLATES.OUT_FOR_DELIVERY;
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
        case 'ARRIVED':
          template = waConfig?.template_arrived || `🔔 *¡Llegó tu pedido!*

Hola {clientName}, el cadete está en la puerta de tu domicilio con tu pedido. ¡Preparate para recibirlo! 🛵`;
          break;
        default:
          // No template for other statuses
          break;
      }

      console.log(`[OrderNotificationListener] Final Template Selection:`, !!template ? "VALID" : "EMPTY");

      if (!template || template.trim() === '') {
         logger.info(`⚠️ [OrderNotificationListener] No template found/set for status: ${newStatus} (Skipping WhatsApp)`);
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
      console.log(`\n--- 📤 SENDING NOTIFICATION ---`);
      console.log(`To: ${phone}`);
      console.log(`Status: ${newStatus}`);
      console.log(`Content:\n${message}`);
      console.log(`-------------------------------\n`);

      // PREMIUM UI: If it's a common status, use buttons
      let waPayload: any = { text: message };
      
      switch (newStatus) {
        case 'CONFIRMED':
          waPayload = {
            interactive: {
              type: 'button',
              body: { text: message },
              action: {
                buttons: [
                  { type: 'reply', reply: { id: 'view_order', title: '📄 Mi Pedido' } },
                  { type: 'reply', reply: { id: 'help', title: '📞 Soporte' } }
                ]
              }
            }
          };
          break;
        case 'OUT_FOR_DELIVERY':
        case 'IN_TRANSIT':
        case 'SHIPPED':
        case 'ENVIADO':
          // Se elimina el bloque interactivo para no "volver locos con los envíos"
          waPayload = { text: message };
          break;
        case 'DELIVERED':
          waPayload = {
            interactive: {
              type: 'button',
              body: { text: message },
              action: {
                buttons: [
                  { type: 'reply', reply: { id: 'rate_excellent', title: '⭐⭐⭐⭐⭐' } },
                  { type: 'reply', reply: { id: 'order_issue', title: '❌ Tuve un problema' } }
                ]
              }
            }
          };
          break;
        case 'READY_FOR_PICKUP':
        case 'READY':
          waPayload = {
            interactive: {
              type: 'button',
              body: { text: message },
              action: {
                buttons: [
                  { type: 'reply', reply: { id: 'view_location', title: '📍 ¿Dónde retiro?' } }
                ]
              }
            }
          };
          break;
      }

      await whatsappClient.sendMessage(phone, waPayload);
      console.log(`✅ [OrderNotificationListener] Premium Notification sent for order ${orderId}`);

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
