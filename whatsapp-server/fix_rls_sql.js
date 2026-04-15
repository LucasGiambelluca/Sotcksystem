require('dotenv').config();
const { supabase } = require('./src/config/database');
const { createClient } = require('@supabase/supabase-js');

// Necesitamos SERVICE_ROLE para alterar políticas
const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fixRLS() {
    console.log('--- Fixing RLS for orders and order_items ---');
    
    const sql = `
    -- 1. Habilitar extensión moddatetime si no está
    CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

    -- 2. Asegurar que RLS esté activo (pero con políticas abiertas)
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

    -- 3. Borrar políticas viejas que puedan estar bloqueando
    DROP POLICY IF EXISTS "Allow all for anon" ON orders;
    DROP POLICY IF EXISTS "Allow all for authenticated" ON orders;
    DROP POLICY IF EXISTS "Allow all public for orders" ON orders;
    DROP POLICY IF EXISTS "Enable all for everyone" ON orders;

    -- 4. Crear política TOTALMENTE ABIERTA (Temporalmente para diagnóstico)
    CREATE POLICY "Enable all for everyone" ON orders 
    FOR ALL TO public 
    USING (true) 
    WITH CHECK (true);

    -- 5. Lo mismo para order_items
    DROP POLICY IF EXISTS "Enable all for everyone" ON order_items;
    CREATE POLICY "Enable all for everyone" ON order_items 
    FOR ALL TO public 
    USING (true) 
    WITH CHECK (true);

    -- 6. Asegurar el trigger de updated_at
    DROP TRIGGER IF EXISTS handle_updated_at ON orders;
    CREATE TRIGGER handle_updated_at BEFORE UPDATE ON orders
        FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);
    `;

    console.log('Applying SQL via anonymous RPC or Direct (Simulation)...');
    // Como no podemos ejecutar SQL crudo directo fácil desde el cliente de supabase 
    // sin una función RPC específica, le daré al usuario el SQL para la consola.
    
    console.log('\nCopiá y pegá este SQL en el SQL Editor de Supabase:\n');
    console.log(sql);
}

fixRLS();
