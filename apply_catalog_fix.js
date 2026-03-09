const fs = require('fs');
const path = require('path');
const dotenvPath = path.join(__dirname, 'whatsapp-server', '.env');
const pgPath = path.join(__dirname, 'whatsapp-server', 'node_modules', 'pg');

if (fs.existsSync(dotenvPath)) {
    require(path.join(__dirname, 'whatsapp-server', 'node_modules', 'dotenv')).config({ path: dotenvPath });
} else {
    console.error('❌ No se encontró el archivo .env en whatsapp-server');
    process.exit(1);
}

const { Client } = require(pgPath);
const connectionString = process.env.DATABASE_URL;

if (!connectionString || connectionString.includes('password')) {
  console.log('⚠️  DATABASE_URL no configurada correctamente.');
  process.exit(1);
}

const migrationFile = path.join(__dirname, 'supabase', 'migrations', '20260309_catalog_enhancements.sql');

async function apply() {
  const client = new Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔗 Conectando a PostgreSQL...');
    await client.connect();
    
    console.log(`📄 Aplicando ${path.basename(migrationFile)}...`);
    const sql = fs.readFileSync(migrationFile, 'utf8');
    await client.query(sql);
    console.log('✅ Migración Exitosa');

  } catch (e) {
    console.error('❌ Error ejecutando SQL:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

apply();
