// src/config/redis.ts

import Redis from 'ioredis';
import 'dotenv/config';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

/**
 * Cliente centralizado de Redis para el bot.
 * Configurado con reintentos mínimos para evitar bloqueos.
 */
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  enableOfflineQueue: false,
  retryStrategy(times) {
      if (times > 3) return null; // stop retrying after 3 attempts
      return Math.min(times * 100, 2000);
  }
});

redis.on('error', (err) => {
  console.error('❌ [RedisConfig] Error:', err.message);
});

redis.on('connect', () => {
  console.log('✅ [RedisConfig] Conectado exitosamente');
});
