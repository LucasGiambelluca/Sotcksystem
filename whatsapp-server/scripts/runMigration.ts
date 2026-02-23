
import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Supabase requires SSL
});

async function run() {
    try {
        await client.connect();
        const migrationPath = path.join(__dirname, '../supabase/migrations/20260218_claims_system.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('Running migration...');
        await client.query(sql);
        console.log('Migration successful!');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await client.end();
    }
}

run();
