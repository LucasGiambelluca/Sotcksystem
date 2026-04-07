import { redis } from '../config/database';
import { logger } from '../utils/logger';

/**
 * DeduplicationService
 * USES Redis to ensure an action is only performed once within a timeframe.
 * Useful for preventing duplicate WhatsApp messages or Printer jobs.
 */
export class DeduplicationService {
    /**
     * Checks if a key exists in Redis. If not, it sets it with an expiration.
     * @param key Unique key for the action (e.g., "notif:orderId:status")
     * @param ttlSeconds TTL in seconds (default 60)
     * @returns Promise<boolean> True if it's a DUPLICATE, False if it's the FIRST time.
     */
    static async isDuplicate(key: string, ttlSeconds: number = 60): Promise<boolean> {
        try {
            // SET with NX (not exists) and EX (expire)
            const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
            
            // If result is 'OK', it was set for the first time (not a duplicate)
            // If result is null, the key already existed (is a duplicate)
            return result === null;
        } catch (err) {
            logger.error(`[DeduplicationService] Error checking key ${key}:`, err);
            // In case of Redis error, we fail safe by allowing the action (not a duplicate)
            return false;
        }
    }
}
