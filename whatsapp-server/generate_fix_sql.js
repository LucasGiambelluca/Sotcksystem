const { supabase } = require('./src/config/database');
const fs = require('fs');
const path = require('path');

async function run() {
    console.log('--- Generando SQL de Migración ---');
    try {
        const { data, error } = await supabase
            .from('flows')
            .select('*')
            .eq('id', 'd7f26b46-2ac6-48bc-ad4e-6547dba77e20')
            .single();

        if (error || !data) {
            console.error('❌ Error: No se encontró el flujo local Tomar Pedido.', error?.message);
            return;
        }

        const sql = `
-- 1. Reparar Esquema (Agregar column is_deleted)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 2. Asegurar que el flujo "Tomar Pedido" exista con el ID correcto
INSERT INTO flows (id, name, description, nodes, edges, is_active, created_at, updated_at)
VALUES (
    '${data.id}',
    '${data.name}',
    '${data.description || 'Flujo de checkout automático'}',
    '${JSON.stringify(data.nodes).replace(/'/g, "''")}'::jsonb,
    '${JSON.stringify(data.edges).replace(/'/g, "''")}'::jsonb,
    true,
    now(),
    now()
)
ON CONFLICT (id) DO UPDATE SET 
    nodes = EXCLUDED.nodes,
    edges = EXCLUDED.edges,
    is_active = true,
    updated_at = now();
        `;

        const targetFile = path.join(__dirname, 'fix_vps_db.sql');
        fs.writeFileSync(targetFile, sql.trim());
        console.log('✅ ÉXITO: SQL generado en:', targetFile);
        console.log('Tamaño del archivo:', fs.statSync(targetFile).size, 'bytes');
    } catch (e) {
        console.error('❌ Error inesperado:', e.message);
    }
}

run();
