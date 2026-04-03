import Redis from 'ioredis';
import { logger } from '../../utils/logger';

class RedisPersistenceService {
    private client: Redis | null = null;
    private readonly TTL = 1800; // 30 minutes in seconds

    constructor() {
        const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        try {
            this.client = new Redis(url, {
                retryStrategy: (times) => {
                    if (times > 3) return null; // Stop retrying after 3 attempts
                    return Math.min(times * 50, 2000);
                }
            });

            this.client.on('error', (err) => {
                logger.error(`[Redis] Connection error: ${err.message}`);
                // Don't crash the app, just log it. We'll fallback to null checks.
            });

            this.client.on('connect', () => {
                logger.info(`[Redis] Connected to ${url}`);
            });
        } catch (e: any) {
            logger.error(`[Redis] Initialization failed: ${e.message}`);
        }
    }

    async setRaw(key: string, value: string, ttl: number = this.TTL): Promise<void> {
        if (!this.client) return;
        try {
            await this.client.set(key, value, 'EX', ttl);
        } catch (e: any) {
            logger.error(`[Redis] setRaw error: ${e.message}`);
        }
    }

    async getRaw(key: string): Promise<string | null> {
        if (!this.client) return null;
        try {
            return await this.client.get(key);
        } catch (e: any) {
            logger.error(`[Redis] getRaw error: ${e.message}`);
            return null;
        }
    }

    async setCheckpoint(phone: string, checkpoint: any): Promise<void> {
        const key = `checkpoint:${phone}`;
        await this.setRaw(key, JSON.stringify({
            ...checkpoint,
            updatedAt: Date.now()
        }));
        logger.debug(`[Redis] Checkpoint saved for ${phone}`);
    }

    async getCheckpoint(phone: string): Promise<any | null> {
        const key = `checkpoint:${phone}`;
        const data = await this.getRaw(key);
        return data ? JSON.parse(data) : null;
    }

    async deleteCheckpoint(phone: string): Promise<void> {
        if (!this.client) return;
        await this.client.del(`checkpoint:${phone}`);
    }

    public isReady(): boolean {
        return !!this.client && this.client.status === 'ready';
    }
}

export const redisPersistence = new RedisPersistenceService();
