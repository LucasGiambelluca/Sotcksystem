const fs = require('fs');
const path = require('path');
require(path.join(__dirname, 'whatsapp-server', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, 'whatsapp-server', '.env') });
const { Client } = require(path.join(__dirname, 'whatsapp-server', 'node_modules', 'pg'));

const connectionString = process.env.DATABASE_URL;

if (!connectionString || connectionString.includes('password')) {
  console.log('⚠️  DATABASE_URL en whatsapp-server/.env no tiene la contraseña real configurada.');
  process.exit(1);
}

const file1 = path.join(__dirname, 'supabase', 'migrations', '20260306_sanitize_schema.sql');
const file2 = path.join(__dirname, 'supabase', 'migrations', '20260306_rls_policies.sql');

async function apply() {
  const client = new Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔗 Conectando a PostgreSQL...');
    await client.connect();
    
    console.log(`📄 Aplicando ${path.basename(file1)}...`);
    const sql1 = fs.readFileSync(file1, 'utf8');
    await client.query(sql1);
    console.log('✅ Migración 1 Exitosa');

    console.log(`📄 Aplicando ${path.basename(file2)}...`);
    const sql2 = fs.readFileSync(file2, 'utf8');
    await client.query(sql2);
    console.log('✅ Migración 2 Exitosa');

  } catch (e) {
    console.error('❌ Error ejecutando SQL:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

apply();
