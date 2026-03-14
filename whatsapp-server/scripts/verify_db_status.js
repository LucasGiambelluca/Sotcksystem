const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Using the keys found in .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: SUPABASE_URL o SUPABASE_SERVICE_KEY no encontrados en .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDB() {
    console.log('🔍 Iniciando verificación de Base de Datos...');
    
    const checks = [
        { name: 'audit_logs', type: 'table' },
        { name: 'flow_executions', column: 'version', type: 'column' },
        { name: 'flow_executions', column: 'session_id', type: 'column' },
        { name: 'inventory', type: 'table' },
        { name: 'products', column: 'synonyms', type: 'column' }
    ];

    const results = [];

    for (const check of checks) {
        try {
            if (check.type === 'table') {
                const { error } = await supabase.from(check.name).select('*', { count: 'exact', head: true }).limit(1);
                results.push({
                    item: check.name,
                    status: error ? '❌' : '✅',
                    details: error ? error.message : 'Tabla detectada'
                });
            } else {
                const { error } = await supabase.from(check.name).select(check.column).limit(1);
                results.push({
                    item: `${check.name}.${check.column}`,
                    status: error && error.code === '42703' ? '❌' : '✅',
                    details: error ? error.message : 'Columna detectada'
                });
            }
        } catch (e) {
            results.push({ item: check.name, status: '❌', details: e.message });
        }
    }

    console.table(results);
    
    // Test NLU Catalog
    try {
        const { data: products } = await supabase.from('products').select('name').eq('is_active', true).limit(1);
        if (products) {
            console.log(`\n🧠 NLU Ready: Conexión con catálogo exitosa.`);
        }
    } catch (e) {
        console.log('\n❌ Error al probar el catálogo.');
    }
}

verifyDB();
