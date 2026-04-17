// src/infrastructure/deduplication/RedisDedup.ts

import { redis } from '../../config/database';
import { BotContext } from '../../core/BotContext';
import { logger } from '../../utils/logger';

/**
 * Servicio de deduplicación distribuida.
 * Utiliza Redis SET NX (Not Exists) para asegurar que un evento (ej. cambio de estado)
 * sea procesado exactamente una vez por bot.
 */
export class RedisDedup {
  private static DEFAULT_TTL = 3600; // 1 hora por defecto

  /**
   * Verifica si un evento es duplicado.
   * Si no existe, lo marca como procesado atómicamente.
   */
  static async isDuplicate(context: BotContext, eventId: string, ttlSeconds: number = this.DEFAULT_TTL): Promise<boolean> {
    const key = context.dedupKey(eventId);
    
    try {
      // SET con NX solo guarda si la key NO existe.
      // Retorna 'OK' si se guardó, null si ya existía.
      const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
      
      return result === null;
    } catch (error: any) {
      logger.error(`[RedisDedup] Error checking duplicate for ${eventId}: ${error.message}`);
      // Fail-safe: Si Redis falla, asumimos NO duplicado para no bloquear el sistema.
      return false;
    }
  }

  /**
   * Borra manualmente una marca de deduplicación.
   * Útil para reintentos forzados o limpieza.
   */
  static async clear(context: BotContext, eventId: string): Promise<void> {
    const key = context.dedupKey(eventId);
    await redis.del(key);
  }
}
