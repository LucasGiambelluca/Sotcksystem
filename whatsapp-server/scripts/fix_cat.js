
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
// Load ENV from current dir
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function run() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('❌ DATABASE_URL not found in .env');
        process.exit(1);
    }

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔗 Conectando a Supabase Postgres...');
        await client.connect();

        const migrationPath = path.join(__dirname, '../supabase/migrations/20260326_catalog_categories_migration.sql');
        console.log(`📄 Leyendo migración: ${migrationPath}`);
        if (!fs.existsSync(migrationPath)) {
            // Try relative to workspace
            const workspaceMigration = path.join(__dirname, '../../../supabase/migrations/20260326_catalog_categories_migration.sql');
            if (fs.existsSync(workspaceMigration)) {
                 const sql = fs.readFileSync(workspaceMigration, 'utf8');
                 console.log('🚀 Ejecutando SQL (workspace path)...');
                 await client.query(sql);
            } else {
                 throw new Error('Migration file not found');
            }
        } else {
            const sql = fs.readFileSync(migrationPath, 'utf8');
            console.log('🚀 Ejecutando SQL...');
            await client.query(sql);
        }

        console.log('✅ Migración completada con éxito.');

    } catch (err) {
        console.error('❌ Error fatal:', err.message);
    } finally {
        await client.end();
    }
}

run();
