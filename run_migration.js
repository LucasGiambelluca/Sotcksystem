const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config({ path: __dirname + '/whatsapp-server/.env' });

async function run() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("No DATABASE_URL found");
        process.exit(1);
    }
    
    console.log("Connecting to", dbUrl);
    
    // Add explicitly ssl if needed, but local supabase usually doesn't need it.
    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();
        const sql = fs.readFileSync(__dirname + '/supabase/migrations/20260220_dashboard_config.sql', 'utf8');
        await client.query(sql);
        console.log("Migration executed successfully.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await client.end();
    }
}

run();
