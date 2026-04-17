// src/api/routes/webhooks.ts

import { Router } from 'express';
import { BotContext } from '../../core/BotContext';
import { QueueManager, NotificationJob } from '../../infrastructure/queue/QueueManager';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';

/**
 * Factory para crear el router de webhooks de un bot específico.
 */
export function createWebhookRouter(context: BotContext, queueManager: QueueManager) {
  const router = Router();

  /**
   * GET /webhook/whatsapp - Verificación de Meta
   */
  router.get('/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      logger.info(`[${context.config.botId}] Webhook Meta VERIFICADO.`);
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });

  /**
   * POST /webhook/whatsapp - Recepción de mensajes de Meta
   */
  router.post('/whatsapp', (req, res) => {
    res.sendStatus(200);
  });

  /**
   * POST /webhook/delivery/at-door - Notificación de "Repartidor en la puerta"
   */
  router.post('/delivery/at-door', async (req, res) => {
    const { orderId, deliveryPersonName } = req.body;

    try {
      const { data: order, error } = await supabase
        .from('orders')
        .select('*, client(id, phone)')
        .eq('id', orderId)
        .single();

      if (error || !order) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      // Encolar notificación prioritaria (priority 1-5)
      const job: NotificationJob = {
        id: `delivery:${orderId}:${Date.now()}`,
        type: 'delivery_arrived',
        phone: order.phone || order.client?.phone,
        message: `🏁 ¡${deliveryPersonName || 'El repartidor'} está en la puerta con tu pedido #${order.order_number}!`,
        metadata: { 
          orderId, 
          status: 'DELIVERY_AT_DOOR',
          oldStatus: 'OUT_FOR_DELIVERY'
        },
      };

      await queueManager.enqueue(job, 1); // Máxima prioridad para llegada de repartidor

      res.json({ success: true, message: 'Notificación de llegada encolada.' });
    } catch (err: any) {
      logger.error(`[${context.config.botId}] Error en webhook delivery: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
