
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from root since it has the DATABASE_URL
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = "postgresql://postgres:Lucas-giambelluca2026@db.zmwzwdgmjrlxtwcwxhhn.supabase.co:5432/postgres";

async function runFix() {
    if (!connectionString) {
        console.error('❌ No DATABASE_URL found in .env');
        process.exit(1);
    }

    console.log('🚀 Connecting to database to apply fixes...');
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL');

        // 1. Drop old constraint
        console.log('Dropping old constraint orders_assigned_to_fkey...');
        await client.query('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_assigned_to_fkey;');

        // 2. Add new constraint to employees
        console.log('Adding new constraint to employees(id)...');
        await client.query(`
            ALTER TABLE orders ADD CONSTRAINT orders_assigned_to_fkey 
            FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL;
        `);

        // 3. Verify columns
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'orders' AND column_name IN ('assigned_to', 'assigned_at');
        `);
        console.log('Orders columns found:', res.rows.map(r => r.column_name));

        console.log('✨ All fixes applied successfully!');
    } catch (err: any) {
        console.error('❌ Error applying fix:', err.message);
    } finally {
        await client.end();
    }
}

runFix().catch(console.error);
