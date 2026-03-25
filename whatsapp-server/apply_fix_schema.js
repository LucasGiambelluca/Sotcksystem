const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Direct connection string with SSL mode
const connectionString = "postgresql://postgres:Lucas-giambelluca2026@db.zmwzwdgmjrlxtwcwxhhn.supabase.co:5432/postgres?sslmode=require";

async function applyMigration() {
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to Supabase DB.");

        const sql = "SELECT 1 as result";

        console.log("Testing connection...");
        const res = await client.query(sql);
        console.log("Connection successful! Result:", res.rows);

    } catch (err) {
        console.error("Migration failed:", err.message);
    } finally {
        await client.end();
    }
}

applyMigration();
