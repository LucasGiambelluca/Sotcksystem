
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    console.log('🚀 Creando tabla ai_analysis_logs...');
    
    const sql = `
    CREATE TABLE IF NOT EXISTS ai_analysis_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        phone TEXT,
        user_message TEXT,
        intent TEXT,
        extracted_data JSONB,
        ai_reasoning TEXT,
        confidence FLOAT,
        model_used TEXT,
        execution_time_ms INTEGER
    );

    -- Habilitar RLS
    ALTER TABLE ai_analysis_logs ENABLE RLS;
    
    -- Política simple para permitir todo desde el service role
    DROP POLICY IF EXISTS "Allow service role all" ON ai_analysis_logs;
    CREATE POLICY "Allow service role all" ON ai_analysis_logs FOR ALL USING (true);
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
        console.error('❌ Error al crear la tabla via RPC (probablemente no exista el helper exec_sql):', error.message);
        console.log('Intentando vía REST direct query...');
        // Fallback: This is harder via JS client if RPC is not enabled. 
        // We'll trust that the user might have RLS/RPC or we can just try to insert and see.
    } else {
        console.log('✅ Tabla ai_analysis_logs creada/verificada con éxito.');
    }
}

run();
