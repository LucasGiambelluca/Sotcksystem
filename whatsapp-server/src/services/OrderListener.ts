// src/services/OrderListener.ts

import { supabase } from '../config/database';
import { BotContext } from '../core/BotContext';
import { QueueManager, NotificationJob } from '../infrastructure/queue/QueueManager';
import { logger } from '../utils/logger';
import { RedisDedup } from '../infrastructure/deduplication/RedisDedup';

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
  private lastPollTime: string = new Date(Date.now() - 60000).toISOString(); // Empezar desde 1 min atrás
  private lastStatusCheck: Map<string, string> = new Map(); // Cache de estados para detectar cambios

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
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        // Estrategia: Buscar órdenes recientes o con timestamps de estado recientes
        // Como no hay updated_at, buscamos órdenes que:
        // 1. Fueron creadas recientemente
        // 2. O tienen timestamps de estado recientes (assigned_at, started_at, etc.)
        const { data: orders, error } = await supabase
          .from('orders')
          .select('id, status, created_at, assigned_at, started_at, ready_at, out_at, delivered_at, cancelled_at, updated_at, chat_context, phone, client_id, order_number')
          .or(`updated_at.gte.${this.lastPollTime},created_at.gte.${this.lastPollTime},out_at.gte.${fiveMinutesAgo},delivered_at.gte.${fiveMinutesAgo}`)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (orders && orders.length > 0) {
          logger.info(`[${this.context.config.botId}] Polling encontró ${orders.length} órdenes con actividad reciente.`);

          for (const order of orders) {
            // Verificar si es una orden nueva o un cambio de estado
            const previousStatus = this.lastStatusCheck.get(order.id);
            const isNewOrder = !previousStatus && order.status;
            const statusChanged = previousStatus && previousStatus !== order.status;

            if (isNewOrder) {
              logger.info(`[${this.context.config.botId}] Nueva orden detectada: ${order.order_number} (${order.status})`);
              await this.handleChange(order, null);
            } else if (statusChanged) {
              logger.info(`[${this.context.config.botId}] Cambio de estado detectado: ${order.order_number} ${previousStatus} -> ${order.status}`);
              const oldOrderData = { ...order, status: previousStatus };
              await this.handleChange(order, oldOrderData);
            }

            // Actualizar el cache de estados
            this.lastStatusCheck.set(order.id, order.status);
          }
        }

        // Actualizar el tiempo de referencia
        this.lastPollTime = now;

        // Limpiar cache de órdenes antiguas (más de 24 horas) para evitar memory leaks
        this.cleanupOldStatusCache();

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
   * Procesa un cambio detectado en la base de datos.
   */
  private async handleChange(newOrder: any, oldOrder: any | null): Promise<void> {
    const orderId = newOrder.id;
    const newStatus = newOrder.status;
    const oldStatus = oldOrder?.status;

    // 0. FILTRADO MANUAL: Verificar si este pedido pertenece a este bot
    const chatContext = newOrder.chat_context || {};
    const orderBotId = chatContext.bot_id;
    const orderSlug = chatContext.catalog_slug;
    const orderBusiness = chatContext.catalog_business_name;

    const myBotId = this.context.config.phoneNumberId;
    const mySlug = this.context.config.catalogSlug;

    let isMyOrder = false;

    // 1. Si el slug coincide, es mío (aunque venga del panel Admin sin bot_id)
    if (mySlug && orderSlug && orderSlug === mySlug) {
      isMyOrder = true;
    } 
    // 2. Si el bot_id coincide, es mío 100%
    else if (myBotId && orderBotId && orderBotId === myBotId) {
      isMyOrder = true;
    }
    // 3. Fallback: El nombre del negocio contiene mi slug
    else if (orderBusiness && mySlug && orderBusiness.toLowerCase().includes(mySlug.toLowerCase())) {
      isMyOrder = true;
    }
    // 4. Dev mode fallback
    else if (!myBotId && !orderBotId && !mySlug) {
      isMyOrder = true;
    }

    // Si no es mi pedido, ignorar
    if (!isMyOrder) {
      return;
    }

    // 1. Evitar redundancia si el status no cambió
    if (newStatus === oldStatus && oldOrder !== null) return;

    // 2. Determinar tipo y prioridad de notificación
    const { type, priority, message } = await this.buildNotification(newOrder, oldStatus);
    if (!message) return;

    // 3. Deduplicación (Prevenir re-procesamiento cruzado)
    const dedupKey = `order:${orderId}:${newStatus}`;
    const isDuplicate = await RedisDedup.isDuplicate(this.context, dedupKey, 300); // 5 min TTL
    if (isDuplicate) return;

    // 4. Encolar en BullMQ
    const job: NotificationJob = {
      id: `notif:${orderId}:${newStatus}`,
      type,
      phone: newOrder.phone || newOrder.client?.phone,
      message,
      metadata: {
        orderId,
        status: newStatus,
        oldStatus: oldStatus || undefined,
      },
    };

    await this.queueManager.enqueue(job, priority);

    logger.info(`[${this.context.config.botId}] Notificación encolada (${newStatus}) -> ${orderId}`);
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

    const { ConfigurationService } = require('./ConfigurationService');
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
          template = appConfig.template_transit || appConfig.template_out_delivery || `🛵 ¡Tu pedido {orderId} ya salió hacia tu domicilio!`;
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
