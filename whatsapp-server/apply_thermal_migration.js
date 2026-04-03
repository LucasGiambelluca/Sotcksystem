require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
    console.error("❌ No connection string found in env");
    process.exit(1);
}

const pool = new Pool({ connectionString });

async function run() {
    const client = await pool.connect();
    try {
        const sql = fs.readFileSync(path.join(__dirname, '20260329_thermal_printer.sql'), 'utf8');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log("✅ Thermal printer migration applied!");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
