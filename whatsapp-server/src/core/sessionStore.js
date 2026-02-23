const { redis } = require('../config/database');

const SESSION_PREFIX = 'wa_session:';
const TTL_SECONDS = 30 * 60; // 30 minutes

class SessionStore {
    /**
     * Get session from Redis
     * @param {string} phone 
     * @returns {Promise<object|null>}
     */
    async get(phone) {
        try {
            const data = await redis.get(`${SESSION_PREFIX}${phone}`);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.error('Session get error:', err);
            return null;
        }
    }

    /**
     * Save session to Redis
     * @param {string} phone 
     * @param {object} data 
     */
    async save(phone, data) {
        try {
            await redis.setex(
                `${SESSION_PREFIX}${phone}`,
                TTL_SECONDS,
                JSON.stringify(data)
            );
        } catch (err) {
            console.error('Session save error:', err);
        }
    }

    /**
     * Delete session
     * @param {string} phone 
     */
    async delete(phone) {
        try {
            await redis.del(`${SESSION_PREFIX}${phone}`);
        } catch (err) {
            console.error('Session delete error:', err);
        }
    }
}

module.exports = new SessionStore();
