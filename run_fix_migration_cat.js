
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load from root .env

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

        const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260326_catalog_categories_migration.sql');
        console.log(`📄 Leyendo migración: ${migrationPath}`);
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('🚀 Ejecutando SQL...');
        await client.query(sql);

        console.log('✅ Migración completada con éxito.');
        
        // Quick verification
        const res = await client.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'catalog_items' AND COLUMN_NAME = 'category_id'");
        if (res.rows.length > 0) {
            console.log('✔️ Verificado: La columna category_id EXISTE ahora.');
        } else {
            console.log('❌ Error: La columna category_id NO se creó.');
        }

    } catch (err) {
        console.error('❌ Error fatal:', err.message);
    } finally {
        await client.end();
    }
}

run();
