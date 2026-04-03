const { createClient } = require('@supabase/supabase-js');

// --- DATOS LOCALES (ORIGEN) ---
const localUrl = 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co';
const localKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptd3p3ZGdtanJseHR3Y3d4aGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAyNTg4MSwiZXhwIjoyMDg5NjAxODgxfQ.gYQ5UXEKqWePvP5JPVGWnQ0jQKlqLpXFYDR77oSSq_c';

// --- DATOS VPS (DESTINO) ---
const vpsUrl = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const vpsKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAyNTg4MCwiZXhwIjoyMDg5NjAxODgwfQ.XpobbRLaNeWFKWc8c58Es0e3k9abPKJa3EzgA0Ri0j8';

const localClient = createClient(localUrl, localKey);
const vpsClient = createClient(vpsUrl, vpsKey);

async function sync() {
    console.log('🚀 Iniciando sincronización de bases de datos...');

    // 1. Obtener flujo "Tomar Pedido" de local
    console.log('📦 Obteniendo flujo "Tomar Pedido" de local...');
    const { data: flow, error: localError } = await localClient
        .from('flows')
        .select('*')
        .eq('id', 'd7f26b46-2ac6-48bc-ad4e-6547dba77e20')
        .single();

    if (localError || !flow) {
        console.error('❌ Error al obtener flujo local:', localError?.message);
        return;
    }

    // 2. Insertar/Actualizar en VPS
    console.log('📤 Subiendo flujo al VPS...');
    const { error: vpsError } = await vpsClient
        .from('flows')
        .upsert(flow);

    if (vpsError) {
        console.error('❌ Error al subir flujo al VPS:', vpsError.message);
        console.log('💡 Tip: Probá crear las columnas is_deleted primero si falla.');
    } else {
        console.log('✅ Flujo "Tomar Pedido" sincronizado correctamente.');
    }

    // 3. Crear columnas en VPS (Opcional, requiere SQL manual usualmente pero probamos RPC si existiera)
    console.log('🛠️ RECUERDA: Ejecutar SQL en el dashboard de Supabase del VPS:');
    console.log('ALTER TABLE products ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;');
    console.log('ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;');

    console.log('✨ Proceso terminado.');
}

sync();
