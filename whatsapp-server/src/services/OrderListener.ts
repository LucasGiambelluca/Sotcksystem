// src/services/OrderListener.ts

import { supabase } from '../config/database';
import { BotContext } from '../core/BotContext';
import { QueueManager, NotificationJob } from '../infrastructure/queue/QueueManager';
import { logger } from '../utils/logger';
import { RedisDedup } from '../infrastructure/deduplication/RedisDedup';
import { ConfigurationService } from './ConfigurationService';

/**
 * Listener de órdenes v2.2.
 * Combina Realtime de Supabase con un Polling de seguridad de 30s.
 * NOTA: La tabla orders no tiene updated_at, usa timestamps específicos por estado.
 */
export class OrderListener {
  private context: BotContext;
  private queueManager: QueueManager;
  private realtimeChannel: any;
  private pollingInterval?: NodeJS.Timeout;
  private lastPollTime: string = new Date(Date.now() - 60000).toISOString();
  private lastStatusCheck: Map<string, string> = new Map(); // Cache de estados para detectar cambios
  private orderBuffer: Map<string, { timer: NodeJS.Timeout, states: string[], order: any }> = new Map();
  private lastProcessed: Map<string, number> = new Map(); // MEJORA V2.9: Throttling
  private readonly DEBOUNCE_MS = 3000;

  private readonly STATUS_SEQUENCE = [
    'PENDING',
    'CONFIRMED',
    'IN_PREPARATION',
    'READY',
    'READY_FOR_PICKUP',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'COMPLETED'
  ];

  constructor(context: BotContext, queueManager: QueueManager) {
    this.context = context;
    this.queueManager = queueManager;
  }

  /**
   * Inicia el monitoreo de la tabla 'orders' para este bot.
   */
  start(): void {
    this.startRealtime();
    this.startPolling(15000); // Polling cada 15 segundos (más frecuente para evitar gaps)
    logger.info(`[${this.context.config.botId}] Listener de órdenes INICIADO (Realtime + Polling 30s).`);
  }

  private startRealtime(): void {
    // IMPORTANTE: Supabase Realtime tiene limitaciones filtrando campos JSON.
    // Escuchamos TODOS los cambios y filtramos manualmente en handleChange.
    this.realtimeChannel = supabase
      .channel(`orders-${this.context.config.botId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          // Sin filtro a nivel de Realtime - filtramos manualmente
        },
        async (payload) => {
          const newOrder = payload.new as any;
          const oldOrder = payload.old as any;
          logger.debug(`[${this.context.config.botId}] Evento Realtime detectado: ${payload.eventType}`);

          // Actualizar cache de estados para detectar cambios
          if (newOrder?.id) {
            this.lastStatusCheck.set(newOrder.id, newOrder.status);
          }

          await this.handleChange(newOrder, oldOrder);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info(`[${this.context.config.botId}] Canal Realtime suscrito exitosamente.`);
        } else {
          logger.warn(`[${this.context.config.botId}] Realtime status: ${status}`);
        }
      });
  }

  private startPolling(intervalMs: number): void {
    this.pollingInterval = setInterval(async () => {
      try {
        const now = new Date().toISOString();
        // MEJORA V3.1: Ventana de búsqueda más amplia (2 min) para evitar saltos por reloj
        const searchTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

        const { data: orders, error } = await supabase
          .from('orders')
          .select('id, status, created_at, assigned_at, started_at, ready_at, out_at, delivered_at, cancelled_at, updated_at, chat_context, phone, client_id, order_number, delivery_type, delivery_address')
          .or(`updated_at.gte.${searchTime},created_at.gte.${searchTime},out_at.gte.${tenMinutesAgo},delivered_at.gte.${tenMinutesAgo}`)
          .order('updated_at', { ascending: true });

        if (error) throw error;

        if (orders && orders.length > 0) {
          logger.info(`[OrderListener] Polling cycle: Found ${orders.length} orders with activity in last 2m`);
          for (const order of orders) {
            const previousStatus = this.lastStatusCheck.get(order.id);
            const isNewOrder = !previousStatus && order.status;
            const statusChanged = previousStatus && previousStatus !== order.status;

            if (isNewOrder || statusChanged) {
              await this.handleChange(order, previousStatus || null);
            }
            this.lastStatusCheck.set(order.id, order.status);
          }
        }
      } catch (err: any) {
        logger.error(`[${this.context.config.botId}] Error en Polling: ${err.message}`);
      }
    }, intervalMs);
  }

  /**
   * Limpia el cache de estados de órdenes antiguas para evitar memory leaks.
   */
  private cleanupOldStatusCache(): void {
    // Mantener solo las últimas 100 órdenes en cache
    if (this.lastStatusCheck.size > 100) {
      const entries = Array.from(this.lastStatusCheck.entries());
      this.lastStatusCheck.clear();
      // Mantener las últimas 50 entradas
      entries.slice(-50).forEach(([id, status]) => {
        this.lastStatusCheck.set(id, status);
      });
      logger.debug(`[${this.context.config.botId}] Cache de estados limpiado.`);
    }
  }

  /**
   * Procesa un cambio detectado con buffering.
   */
  private async handleChange(newOrder: any, oldStatus: string | null): Promise<void> {
    const orderId = newOrder.id;
    const newStatus = newOrder.status;
    const now = Date.now();

    logger.info(`[OrderListener] Detected order ${newOrder.order_number} change: ${oldStatus} -> ${newStatus}`);

    // MEJORA V2.9: Throttling de Realtime/Polling
    const throttleKey = `${orderId}:${newStatus}`;
    const last = this.lastProcessed.get(throttleKey) || 0;
    if (now - last < 2000) {
        logger.debug(`[OrderListener] Throttling: Omitiendo evento repetido para ${newOrder.order_number}:${newStatus}`);
        return;
    }
    this.lastProcessed.set(throttleKey, now);

    if (!this.isMyOrder(newOrder)) {
        logger.info(`[OrderListener] Skipping order ${newOrder.order_number} (Not for this bot/slug)`);
        return;
    }
    if (newStatus === oldStatus && oldStatus !== null) return;

    // Actualizar cache local
    this.lastStatusCheck.set(orderId, newStatus);

    // Buffering inteligente
    if (this.orderBuffer.has(orderId)) {
        const buf = this.orderBuffer.get(orderId)!;
        clearTimeout(buf.timer);
        if (!buf.states.includes(newStatus)) buf.states.push(newStatus);
        buf.order = { ...buf.order, ...newOrder };
        logger.debug(`[OrderListener] Buffer actualizado para ${newOrder.order_number}: ${buf.states.join(', ')}`);
        buf.timer = setTimeout(() => this.flushBuffer(orderId), 1000); // Reducido a 1s
    } else {
        logger.debug(`[OrderListener] Nuevo buffer creado para ${newOrder.order_number}: [${newStatus}]`);
        const timer = setTimeout(() => this.flushBuffer(orderId), 1000); // Reducido a 1s
        this.orderBuffer.set(orderId, { timer, states: [newStatus], order: newOrder });
    }
  }

  private isMyOrder(order: any): boolean {
    const chatContext = order.chat_context || {};
    const orderBotId = String(chatContext.bot_id || '');
    const orderSlug = String(chatContext.catalog_slug || '');
    const orderBusiness = String(chatContext.catalog_business_name || '').toLowerCase();

    const myBotId = String(this.context.config.phoneNumberId || '');
    const mySlug = String(this.context.config.catalogSlug || '');

    // MEJORA V3.1: Match más robusto (evitar problemas de tipos string/number)
    if (mySlug && orderSlug && orderSlug === mySlug) return true;
    if (myBotId && orderBotId && orderBotId === myBotId) return true;
    if (orderBusiness && mySlug && orderBusiness.includes(mySlug.toLowerCase())) return true;
    
    // Fallback: si no hay bot_id pero el slug coincide (o viceversa)
    if (!orderBotId && orderSlug === mySlug) return true;

    return false;
  }

  private async flushBuffer(orderId: string) {
    const buf = this.orderBuffer.get(orderId);
    if (!buf) return;
    this.orderBuffer.delete(orderId);

    const { states, order } = buf;
    const finalStatus = states[states.length - 1];

    // Replay logic Mejorado: Forzar hitos obligatorios
    const milestones = ['CONFIRMED', 'IN_PREPARATION', 'OUT_FOR_DELIVERY'];
    const toSend = [...states];
    
    // Si llegamos a DELIVERED pero nos falta algún hito intermedio, lo inyectamos
    if (finalStatus === 'DELIVERED' || finalStatus === 'COMPLETED') {
        for (const m of milestones) {
            if (!toSend.includes(m)) {
                // Si el hito no está en la ráfaga actual, verificar si se envió antes (via Dedup)
                const dedupKey = `order:${orderId}:${m}`;
                const alreadySent = await RedisDedup.isDuplicate(this.context, dedupKey, 300);
                if (!alreadySent) {
                    logger.info(`[OrderListener] Hito '${m}' faltante detectado para ${order.order_number}. Replay inyectado.`);
                    toSend.splice(toSend.length - 1, 0, m);
                }
            }
        }
    }

    // Consolidar si hay ráfaga (>1 nuevo estado detectado)
    if (toSend.length > 1) {
        logger.info(`[OrderListener] ráfaga detectada para ${order.order_number}: ${toSend.join(' -> ')}`);
        // MEJORA V2.7: Separar DELIVERED
        if (finalStatus === 'DELIVERED' || finalStatus === 'COMPLETED' || finalStatus === 'CANCELLED' || finalStatus.includes('ENTREGADO')) {
            const intermediateStates = toSend.filter(s => s !== finalStatus);
            if (intermediateStates.length > 0) {
                const intermediateMsg = await this.buildConsolidatedMessage(order, intermediateStates);
                if (intermediateMsg) {
                    await this.enqueueNotification(order, intermediateStates[intermediateStates.length-1], intermediateMsg, 10);
                }
            }
            const { message: finalMsg, priority } = await this.buildNotification({...order, status: finalStatus}, null);
            if (finalMsg) await this.enqueueNotification(order, finalStatus, finalMsg, priority);
        } else {
            const message = await this.buildConsolidatedMessage(order, toSend);
            if (message) {
                await this.enqueueNotification(order, finalStatus, message, 10);
            } else {
                const { message: singleMsg } = await this.buildNotification({...order, status: finalStatus}, null);
                if (singleMsg) await this.enqueueNotification(order, finalStatus, singleMsg, 10);
            }
        }
    } else {
        logger.info(`[OrderListener] Procesando estado individual para ${order.order_number}: ${finalStatus}`);
        const { message, priority } = await this.buildNotification({...order, status: finalStatus}, null);
        if (message) {
            await this.enqueueNotification(order, finalStatus, message, priority);
        } else {
            logger.warn(`[OrderListener] No se generó mensaje para estado ${finalStatus} (#${order.order_number})`);
        }
    }
  }

  private async enqueueNotification(order: any, status: string, message: string, priority: number) {
    const dedupKey = `order:${order.id}:${status}`;
    const isDuplicate = await RedisDedup.isDuplicate(this.context, dedupKey, 300);
    if (isDuplicate) {
        logger.debug(`[OrderListener] Notificación duplicada omitida: ${dedupKey}`);
        return;
    }

    const phone = order.phone || order.client?.phone || order.chat_context?.phone;
    if (!phone) {
        logger.warn(`[OrderListener] No se pudo encontrar teléfono para la orden ${order.order_number}`);
        return;
    }

    await this.queueManager.enqueue({
      id: `notif:${order.id}:${status}`,
      type: 'status_change',
      phone,
      message,
      metadata: { orderId: order.id, status }
    }, priority);
    
    logger.info(`[${this.context.config.botId}] ✅ Notificación encolada (${status}) -> ${order.order_number}`);
  }

  private detectPickup(order: any): boolean {
    const dtLower = (order.delivery_type || '').toLowerCase();
    const adLower = (order.delivery_address || '').toLowerCase();
    const ctxLower = JSON.stringify(order.chat_context || {}).toLowerCase();
    
    return dtLower === 'pickup' || 
           dtLower.includes('retiro') || 
           dtLower.includes('local') || 
           adLower.includes('retiro') || 
           adLower.includes('local') ||
           ctxLower.includes('retiro') ||
           ctxLower.includes('local');
  }

  private async buildConsolidatedMessage(order: any, states: string[]): Promise<string | null> {
    const rawStatus = states[states.length - 1]?.toUpperCase() || '';
    const orderNumber = order.order_number || order.id.slice(0, 8);
    const isPickup = this.detectPickup(order);

    const appConfig = await ConfigurationService.getFullConfig();
    const clientName = order.client?.name || order.chat_context?.pushName || 'Cliente';
    const deliveryAddress = order.delivery_address || '';

    // MEJORA V2.8: Mapeo de estados multi-idioma (Inglés/Español)
    const isPreparing = rawStatus === 'IN_PREPARATION' || rawStatus === 'PREPARING' || rawStatus.includes('PREPARACION');
    const isTransit = rawStatus === 'OUT_FOR_DELIVERY' || rawStatus === 'IN_TRANSIT' || rawStatus.includes('ENTREGA') || states.some(s => s.toUpperCase().includes('ENTREGA') || s.toUpperCase().includes('TRANSIT') || s.toUpperCase().includes('OUT_FOR'));
    const isReady = rawStatus === 'READY' || rawStatus === 'READY_FOR_PICKUP' || rawStatus.includes('LISTO');
    const isDelivered = rawStatus === 'DELIVERED' || rawStatus === 'COMPLETED' || rawStatus.includes('ENTREGADO');
    
    if (isPreparing) {
        const prepMsg = appConfig.template_preparation ? appConfig.template_preparation : `✅ *Pedido #{orderId} Actualizado*\r\n\r\n¡Buenas noticias {clientName}! Tu pedido ya fue confirmado y está siendo preparado en cocina. 👨‍🍳`;
        return prepMsg
            .replace(/\{orderId\}/g, orderNumber)
            .replace(/\{clientName\}/g, clientName);
    }

    if ((isTransit || isReady) && !isDelivered) {
        if (isPickup) {
            const template = appConfig.template_ready || `🥡 *Pedido #{orderId} Listo*\r\n\r\n¡Buenas noticias {clientName}! Tu pedido ya está listo para que lo pases a retirar. ¡Te esperamos! 🎉`;
            return template
                .replace(/\{orderId\}/g, orderNumber)
                .replace(/\{clientName\}/g, clientName);
        } else {
            const template = appConfig.template_transit || `🚚 *Pedido #{orderId} en camino*\r\n\r\n¡Buenas noticias {clientName}! Tu pedido ya está listo y salió hacia tu domicilio: {deliveryAddress}. 🛵`;
            return template
                .replace(/\{orderId\}/g, orderNumber)
                .replace(/\{clientName\}/g, clientName)
                .replace(/\{deliveryAddress\}/g, deliveryAddress);
        }
    }

    if (isDelivered) {
        const template = appConfig.template_delivered || `✅ *Pedido #{orderId} Entregado*\r\n\r\n¡Tu pedido ya fue entregado! Gracias por confiar en nosotros. 🎉`;
        return template
            .replace(/\{orderId\}/g, orderNumber)
            .replace(/\{clientName\}/g, clientName);
    }
    return null;
  }

  /**
   * Lógica de negocio para mapear estados a mensajes y prioridades utilizando ConfigurationService.
   */
  private async buildNotification(order: any, oldStatus: string | null): Promise<{
    type: 'order_new' | 'status_change';
    priority: number;
    message: string | null;
  }> {
    const isNew = oldStatus === null || oldStatus === undefined;
    const status = order.status;
    const orderNumber = order.order_number || order.id.slice(0, 8);

    const appConfig = await ConfigurationService.getFullConfig();

    const dtLower = (order.delivery_type || '').toLowerCase();
    const adLower = (order.delivery_address || '').toLowerCase();
    const isPickup = dtLower === 'pickup' || dtLower.includes('retiro') || dtLower.includes('local') || adLower.includes('retiro') || adLower.includes('local');

    let template = '';
    const clientName = order.client?.name || order.chat_context?.pushName || 'Cliente';
    const deliveryAddress = order.delivery_address || '';

    switch (status) {
      case 'PENDING':
        template = `✅ Pedido recibido! Número: {orderId}. Te avisamos cuando esté listo.`;
        break;
      case 'CONFIRMED':
        template = appConfig.template_confirmed || `✅ Pedido {orderId} ha sido CONFIRMADO. ¡Gracias!`;
        break;
      case 'IN_PREPARATION':
        template = appConfig.template_preparation || `👨‍🍳 Tu pedido {orderId} está en preparación.`;
        break;
      case 'IN_TRANSIT':
      case 'OUT_FOR_DELIVERY':
      case 'SHIPPED':
        if (isPickup) {
          template = appConfig.template_ready || `🎉 ¡Tu pedido {orderId} está listo para retirar!`;
        } else {
          template = appConfig.template_transit || `🛵 ¡Tu pedido {orderId} ya salió hacia tu domicilio!`;
        }
        break;
      case 'READY':
      case 'READY_FOR_PICKUP':
        template = appConfig.template_ready || `🎉 ¡Tu pedido {orderId} está listo!`;
        break;
      case 'DELIVERED':
        template = appConfig.template_delivered || `✅ Pedido {orderId} entregado. ¡Buen provecho!`;
        await this.createInternalNotification(order);
        break;
      case 'CANCELLED':
        template = appConfig.template_cancelled || `❌ Lo sentimos, tu pedido {orderId} ha sido cancelado.`;
        break;
      case 'ARRIVED':
        template = appConfig.template_arrived || `🔔 ¡Llegó tu pedido!\nEl cadete está en la puerta.`;
        break;
    }

    if (!template) {
        return { type: isNew ? 'order_new' : 'status_change', priority: 20, message: null };
    }

    let message = template
      .replace(/\{clientName\}/g, clientName)
      .replace(/\{orderId\}/g, orderNumber)
      .replace(/\{deliveryAddress\}/g, deliveryAddress);

    let type: 'order_new' | 'status_change' = isNew ? 'order_new' : 'status_change';
    let priority = 20;

    if (isNew) {
      priority = 10;
    } else if (status === 'OUT_FOR_DELIVERY' || status === 'READY_FOR_PICKUP' || status === 'IN_TRANSIT') {
      priority = 5;
    }

    return { type, priority, message };
  }

  private async createInternalNotification(order: any) {
    try {
      logger.info(`[OrderListener] Creando notificación interna para el comercio...`);
      await supabase.from('notifications').insert({
        title: '✅ Entrega Confirmada',
        message: `El pedido #${order.order_number || order.id.slice(0, 8)} de ${order.client?.name || order.phone} ha sido entregado.`,
        type: 'DELIVERY_CONFIRMED',
        metadata: { orderId: order.id, orderNumber: order.order_number, botId: this.context.config.botId },
        read: false
      });
    } catch (err: any) {
      logger.error(`[OrderListener] Error creating internal notification: ${err.message}`);
    }
  }

  /**
   * Detiene el listener limpiando recursos.
   */
  stop(): void {
    if (this.realtimeChannel) supabase.removeChannel(this.realtimeChannel);
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    logger.info(`[${this.context.config.botId}] Listener DETENIDO.`);
  }
}
