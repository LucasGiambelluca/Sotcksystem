// src/core/BotContext.ts

export interface BotConfig {
  botId: string;                    // e.g., 'eldelirio', 'pollo'
  phoneNumberId?: string;           // ID oficial de Meta (opcional en local/QR)
  accessToken?: string;             // Token WABA (opcional en local/QR)
  catalogSlug: string;              // Identificador de catálogo para filtros de base de datos
  maxConcurrentJobs: number;        // Cantidad de Workers paralelos
  messagesPerMinute: number;       // Límite de velocidad (Rate Limit)
  isLocal?: boolean;                // Flag para modo Baileys/QR
}

/**
 * BotContext proporciona aislamiento garantizado entre múltiples instancias de bots
 * que corren en el mismo servidor o comparten la misma base de datos/Redis.
 */
export class BotContext {
  readonly config: BotConfig;
  
  constructor(config: BotConfig) {
    this.config = config;
  }

  /**
   * Prefijo único para todas las keys de Redis de este bot.
   * Evita colisiones si varios bots comparten la misma instancia de Redis.
   */
  get prefix(): string {
    return `bot:${this.config.botId}`;
  }

  /**
   * Genera el nombre de una cola específica para este bot.
   * IMPORTANTE: No usar ':' en el nombre de la cola (requerido por BullMQ).
   */
  queueName(type: 'priority' | 'standard' | 'retry' | 'notifications'): string {
    return `${this.config.botId}-queue-${type}`;
  }

  /**
   * Genera una key de Redis con el prefijo del bot.
   */
  key(...parts: string[]): string {
    return `${this.prefix}:${parts.join(':')}`;
  }

  /**
   * Genera la key de deduplicación de eventos.
   * Usamos 'dedup' como namespace intermedio para fácil limpieza.
   */
  dedupKey(eventId: string): string {
    return `dedup:${this.prefix}:${eventId}`;
  }
}
