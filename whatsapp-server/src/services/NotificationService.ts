// src/services/NotificationService.ts

import { BotContext, BotConfig } from '../core/BotContext';
import { QueueManager } from '../infrastructure/queue/QueueManager';
import { NotificationWorker } from '../infrastructure/queue/NotificationWorker';
import { OrderListener } from './OrderListener';
import { logger } from '../utils/logger';

/**
 * Orquestador central del sistema de notificaciones v2.1.
 * Maneja el ciclo de vida de cada bot: Contexto, Colas, Workers y Listeners.
 */
export class NotificationService {
  private static instance: NotificationService;
  private bots: Map<string, { 
    context: BotContext, 
    queueManager: QueueManager, 
    worker: NotificationWorker, 
    listener: OrderListener 
  }> = new Map();

  private constructor() {}

  static getInstance(): NotificationService {
    if (!this.instance) {
      this.instance = new NotificationService();
    }
    return this.instance;
  }

  /**
   * Registra e inicia un nuevo bot en el sistema.
   */
  async registerBot(config: BotConfig): Promise<void> {
    if (this.bots.has(config.botId)) {
      logger.warn(`[NotificationService] El bot '${config.botId}' ya está registrado.`);
      return;
    }

    logger.info(`🚀 [NotificationService] Registrando bot: ${config.botId} (${config.isLocal ? 'MODO LOCAL/QR' : 'MODO OFICIAL'})`);

    const context = new BotContext(config);
    const queueManager = new QueueManager(context);
    const worker = new NotificationWorker(context, queueManager);
    const listener = new OrderListener(context, queueManager);

    // Iniciar el listener de base de datos
    listener.start();

    this.bots.set(config.botId, { context, queueManager, worker, listener });
    logger.info(`✅ [NotificationService] Bot '${config.botId}' iniciado correctamente.`);
  }

  /**
   * Detiene todos los procesos de un bot específico.
   */
  async stopBot(botId: string): Promise<void> {
    const bot = this.bots.get(botId);
    if (!bot) return;

    bot.listener.stop();
    await bot.worker.close();
    this.bots.delete(botId);
    logger.info(`🛑 [NotificationService] Bot '${botId}' detenido.`);
  }

  /**
   * Obtiene estadísticas globales del sistema de colas.
   */
  async getGlobalStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};
    for (const [botId, bot] of this.bots) {
      stats[botId] = await bot.queueManager.getStats();
    }
    return stats;
  }
}

export const notificationService = NotificationService.getInstance();
