import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

let DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL no encontrada en .env');
    process.exit(1);
}

async function applyFix() {
    console.log('🚀 Iniciando aplicación del parche de RLS y Realtime (vía Config Object)...');
    
    const client = new Client({
        user: 'postgres.zmwzwdgmjrlxtwcwxhhn',
        host: 'aws-0-sa-east-1.pooler.supabase.com',
        database: 'postgres',
        password: 'Lucas-giambelluca2026',
        port: 6543,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log('✅ Conectado a la base de datos.');

        console.log('📜 Ejecutando comandos de RLS y Realtime uno por uno...');
        
        // 1. Enable RLS
        await client.query('ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;');
        await client.query('ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;');
        await client.query('ALTER TABLE clients ENABLE ROW LEVEL SECURITY;');
        console.log('✅ RLS Habilitado.');

        // 2. Create Policies
        await client.query('DROP POLICY IF EXISTS "whatsapp_messages_admin_all" ON whatsapp_messages;');
        await client.query('CREATE POLICY "whatsapp_messages_admin_all" ON whatsapp_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);');
        
        await client.query('DROP POLICY IF EXISTS "whatsapp_conversations_admin_all" ON whatsapp_conversations;');
        await client.query('CREATE POLICY "whatsapp_conversations_admin_all" ON whatsapp_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);');
        
        await client.query('DROP POLICY IF EXISTS "clients_admin_all" ON clients;');
        await client.query('CREATE POLICY "clients_admin_all" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);');
        console.log('✅ Políticas creadas.');

        // 3. Realtime Publication (ignore error if already exists)
        try {
            await client.query('ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;');
        } catch (e: any) {
            console.log('ℹ️ whatsapp_messages ya estaba en la publicación o error omitido.');
        }

        try {
            await client.query('ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversations;');
        } catch (e: any) {
            console.log('ℹ️ whatsapp_conversations ya estaba en la publicación o error omitido.');
        }
        
        console.log('🎉 Parche aplicado exitosamente.');
    } catch (error) {
        console.error('❌ Error ejecutando el parche:', error);
    } finally {
        await client.end();
    }
}

applyFix();
