// import Redis from 'ioredis';
 
 export class SessionStore {
     // private redis: Redis;
     private sessions: Map<string, any> = new Map();
     private readonly PREFIX = 'session:';
 
     constructor() {
        /*
         this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
             lazyConnect: true // Don't connect immediately to avoid startup crash
         });
         this.redis.on('error', (err) => {
             console.error('Redis Client Error:', err);
         });
         */
        console.log('SessionStore initialized with Map (in-memory)');
     }
 
     async getSession(phoneNumber: string) {
         // const data = await this.redis.get(`${this.PREFIX}${phoneNumber}`);
         // return data ? JSON.parse(data) : null;
         return this.sessions.get(phoneNumber) || null;
     }
 
     async saveSession(phoneNumber: string, data: any) {
         /*
         await this.redis.set(
             `${this.PREFIX}${phoneNumber}`, 
             JSON.stringify(data), 
             'EX', 
             3600 // 1 hour expiration
         );
         */
        this.sessions.set(phoneNumber, data);
     }
 
     async updateSession(phoneNumber: string, updates: any) {
         const current = await this.getSession(phoneNumber) || {};
         const updated = { ...current, ...updates };
         await this.saveSession(phoneNumber, updated);
         return updated;
     }
 
     async clearSession(phoneNumber: string) {
         // await this.redis.del(`${this.PREFIX}${phoneNumber}`);
         this.sessions.delete(phoneNumber);
     }
 }
