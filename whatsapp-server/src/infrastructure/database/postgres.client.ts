import { Pool } from 'pg';

export class PostgresClient {
    private pool: Pool;

    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false } // Adjust for production
        });
    }

    async query(text: string, params: any[]) {
        return this.pool.query(text, params);
    }

    async getClient() {
        return this.pool.connect();
    }
}
