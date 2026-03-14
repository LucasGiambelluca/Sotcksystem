const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function forceFix() {
    console.log('🚀 Iniciando reparación forzada de Base de Datos...');
    
    const queries = [
        "ALTER TABLE public.flow_executions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();",
        "ALTER TABLE public.flow_executions ADD COLUMN IF NOT EXISTS session_id TEXT;",
        "ALTER TABLE public.flow_executions ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;",
        "ALTER TABLE public.products ADD COLUMN IF NOT EXISTS synonyms TEXT[];",
        "NOTIFY pgrst, 'reload schema';"
    ];

    for (const q of queries) {
        console.log(`Ejecutando: ${q}`);
        const { error } = await supabase.rpc('execute_sql', { sql_query: q });
        if (error) console.error(`❌ Error: ${error.message}`);
        else console.log('✅ OK');
    }

    console.log('\n📊 Verificando columnas finales...');
    const { data, error: e } = await supabase.from('flow_executions').select('*').limit(1);
    if (e) console.error('❌ Error persistente:', e.message);
    else console.log('✅ Columnas detectadas:', Object.keys(data[0] || {}));
}

forceFix();
