// src/infrastructure/queue/QueueManager.ts

import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { BotContext } from '../../core/BotContext';
import { logger } from '../../utils/logger';
import { RedisDedup } from '../deduplication/RedisDedup';

/**
 * Tipos de prioridades para las colas.
 */
export type QueueType = 'priority' | 'standard' | 'retry' | 'main';

export interface NotificationJob {
  id: string;                       // Identificador único para deduplicación (ej: 'order:uuid:status')
  type: 'order_new' | 'status_change' | 'delivery_arrived';
  phone: string;
  message: string;
  metadata: {
    orderId: string;
    status: string;
    oldStatus?: string;
    attempt?: number;
  };
}

/**
 * Manejador de colas BullMQ.
 * Centraliza la creación y adición de trabajos a colas aisladas por bot.
 */
export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private context: BotContext;

  constructor(context: BotContext) {
    this.context = context;
    this.initializeQueues();
  }

  /**
   * Inicializa la cola única para este bot.
   */
  private initializeQueues(): void {
    const name = this.context.queueName('notifications'); // Una sola cola
    
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.queues.set('main', new Queue(name, {
      connection: new Redis(redisUrl, { maxRetriesPerRequest: null }) as any,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }));
    
    logger.info(`[QueueManager] Cola '${name}' inicializada.`);
  }

  /**
   * Encola un nuevo trabajo de notificación con deduplicación y prioridad.
   */
  async enqueue(
    job: NotificationJob,
    priority: number = 20, // BullMQ: lower is higher priority (1 is highest)
    options?: { delay?: number }
  ): Promise<Job | null> {
    const queue = this.queues.get('main');
    
    if (!queue) {
      logger.error(`[QueueManager] No se encontró la cola principal`);
      return null;
    }

    // 1. Verificación de duplicación antes de encolar
    const isDuplicate = await RedisDedup.isDuplicate(this.context, job.id);
    if (isDuplicate) {
      logger.debug(`[QueueManager] Job duplicado ignorado: ${job.id}`);
      return null;
    }

    // 2. Añadir a BullMQ
    return queue.add(job.type, job, {
      jobId: job.id,
      priority, // 1-10 para pedidos nuevos, 20 para cambios, 30 para resto
      ...options,
    });
  }

  /**
   * Obtiene estadísticas rápidas para monitoreo.
   */
  async getStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};
    for (const [type, queue] of this.queues) {
      stats[type] = {
        waiting: await queue.getWaitingCount(),
        active: await queue.getActiveCount(),
        completed: await queue.getCompletedCount(),
        failed: await queue.getFailedCount(),
      };
    }
    return stats;
  }
}
