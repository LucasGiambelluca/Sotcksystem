const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function applyFixes() {
    console.log('🚀 Iniciando reparación de base de datos...');

    // 1. Crear tabla audit_logs
    console.log('📌 Creando tabla audit_logs...');
    const { error: auditError } = await supabase.rpc('execute_sql', {
        sql_query: `
            CREATE TABLE IF NOT EXISTS public.audit_logs (
                id BIGSERIAL PRIMARY KEY,
                timestamp TIMESTAMPTZ DEFAULT NOW(),
                session_id TEXT NOT NULL,
                user_phone TEXT NOT NULL,
                event_type TEXT NOT NULL,
                message_id TEXT,
                details JSONB DEFAULT '{}'::jsonb,
                stack_trace TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON public.audit_logs(session_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);
        `
    }).catch(async () => {
        // Alt: if RPC fails, try generic query if possible, or just log manual SQL
        console.log('⚠️ RPC execute_sql not available. Please run this SQL manually in Supabase SQL Editor:');
        console.log(`
            CREATE TABLE IF NOT EXISTS public.audit_logs (
                id BIGSERIAL PRIMARY KEY,
                timestamp TIMESTAMPTZ DEFAULT NOW(),
                session_id TEXT NOT NULL,
                user_phone TEXT NOT NULL,
                event_type TEXT NOT NULL,
                message_id TEXT,
                details JSONB DEFAULT '{}'::jsonb,
                stack_trace TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON public.audit_logs(session_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);
            
            -- Asegurar version en flow_executions
            ALTER TABLE public.flow_executions ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
        `);
        return { error: 'RPC_NOT_FOUND' };
    });

    if (auditError && auditError !== 'RPC_NOT_FOUND') {
        console.error('❌ Error al crear audit_logs:', auditError);
    } else {
        console.log('✅ Estructura de auditoría verificada.');
    }

    // 2. Add version to flow_executions
    console.log('📌 Verificando columna version en flow_executions...');
    try {
        await supabase.rpc('execute_sql', {
            sql_query: `ALTER TABLE public.flow_executions ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;`
        });
        console.log('✅ Columna version verificada.');
    } catch (e) {}

    console.log('🏁 Proceso finalizado.');
}

applyFixes();
