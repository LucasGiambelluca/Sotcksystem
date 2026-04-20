// src/infrastructure/queue/NotificationWorker.ts

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { BotContext } from '../../core/BotContext';
import { logger } from '../../utils/logger';
import { QueueManager, NotificationJob } from './QueueManager';
import { whatsappClient } from '../whatsapp/WhatsAppClient';
import { supabase } from '../../config/database';

/**
 * Worker encargado de procesar la cola de notificaciones de un bot.
 * Escucha la cola única 'notifications' usando las prioridades de BullMQ.
 */
export class NotificationWorker {
  private worker: Worker;
  private context: BotContext;
  private queueManager: QueueManager;

  constructor(context: BotContext, queueManager: QueueManager) {
    this.context = context;
    this.queueManager = queueManager;

    // El worker escucha la cola única del bot
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.worker = new Worker(
      this.context.queueName('notifications'),
      this.processJob.bind(this),
      {
        connection: new Redis(redisUrl, { maxRetriesPerRequest: null }) as any,
        concurrency: this.context.config.maxConcurrentJobs || 3,
        limiter: {
          max: this.context.config.messagesPerMinute || 80,
          duration: 60000,
        },
      }
    );

    this.setupEventHandlers();
  }

  private async processJob(job: Job<NotificationJob>): Promise<void> {
    const { phone, message, type, metadata } = job.data;
    
    logger.info(`[${this.context.config.botId}] Procesando ${type} para ${phone} (Prioridad: ${job.priority})`);

    try {
      // 1. Enviar vía el cliente unificado (Baileys o Official)
      const payload = typeof message === 'string' ? { text: message } : message;
      await whatsappClient.sendMessage(phone, payload);

      // 2. Registrar éxito en DB
      await this.logNotification(job.data, 'success');

    } catch (error: any) {
      logger.error(`[${this.context.config.botId}] Error en Worker (${job.id}): ${error.message}`);
      
      // Manejo de errores de reintento
      if (error.response?.status === 429 || error.message?.includes('rate limit')) {
        throw new Error('RATE_LIMIT_RETRY'); 
      }

      await this.logNotification(job.data, 'failed', error.message);
      throw error;
    }
  }

  private async logNotification(job: NotificationJob, status: string, error?: string): Promise<void> {
    try {
      await supabase.from('notification_logs').insert({
        bot_id: this.context.config.botId,
        order_id: job.metadata.orderId,
        phone: job.phone,
        type: job.type,
        status: status,
        error_details: error,
        sent_at: new Date().toISOString()
      });
    } catch (e) {
      // Silencioso
    }
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      logger.info(`[${this.context.config.botId}] ✅ Notificación Enviada: ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`[${this.context.config.botId}] ❌ Error en ${job?.id}: ${err.message}`);
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
