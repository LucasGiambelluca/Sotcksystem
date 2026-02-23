require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL; // Adapt based on .env

if (!connectionString) {
    console.error("❌ No DATABASE_URL found in env");
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString,
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log("🚀 Starting migration...");
        
        const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260216_kitchenflow_v2_fase1.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log(`📜 Executing SQL from ${migrationPath}...`);
        
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        
        console.log("✅ Migration applied successfully!");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
