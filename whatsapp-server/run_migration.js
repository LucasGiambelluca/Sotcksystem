const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

async function run() {
    let dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
    dbUrl = dbUrl.replace('localhost', '127.0.0.1'); // Force IPv4
    
    console.log("Connecting to", dbUrl);
    
    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();
        const sql = fs.readFileSync(__dirname + '/../supabase/migrations/20260220_dashboard_config.sql', 'utf8');
        await client.query(sql);
        console.log("Migration executed successfully.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await client.end();
    }
}

run();
