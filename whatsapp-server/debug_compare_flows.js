const { createClient } = require('@supabase/supabase-js');

// --- DATOS LOCALES (ORIGEN) ---
const localUrl = 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co';
const localKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptd3p3ZGdtanJseHR3Y3d4aGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAyNTg4MSwiZXhwIjoyMDg5NjAxODgxfQ.gYQ5UXEKqWePvP5JPVGWnQ0jQKlqLpXFYDR77oSSq_c';

// --- DATOS VPS (DESTINO) ---
const vpsUrl = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const vpsKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjU4ODIsImV4cCI6MjA4OTYwMTg4Mn0.N-E0A_V78kC9D5E5BC2255C8B';

const localClient = createClient(localUrl, localKey);
const vpsClient = createClient(vpsUrl, vpsKey);

async function compare() {
    console.log('🔍 COMPARATIVA DE FLUJOS (LOCAL vs VPS)');
    console.log('========================================');

    // 1. Obtener flujos de local
    const { data: localFlows } = await localClient.from('flows').select('id, name, is_active');
    // 2. Obtener flujos de VPS
    const { data: vpsFlows } = await vpsClient.from('flows').select('id, name, is_active');

    console.log('\n--- Flujos en LOCAL (zmwzw...) ---');
    localFlows.forEach(f => console.log(`- [${f.id}] ${f.name} (Active: ${f.is_active})`));

    console.log('\n--- Flujos en VPS (bomzcid...) ---');
    if (vpsFlows) {
        vpsFlows.forEach(f => console.log(`- [${f.id}] ${f.name} (Active: ${f.is_active})`));
    } else {
        console.log('No se pudieron obtener flujos del VPS (Check Key/URL)');
    }

    console.log('\n--- Análisis de Nodos Específicos ---');
    const { data: nodeCheckLocal } = await localClient.from('flows').select('nodes').eq('id', 'd7f26b46-2ac6-48bc-ad4e-6547dba77e20').single();
    if (nodeCheckLocal) {
        const hasNode = nodeCheckLocal.nodes.some(n => n.id === 'n_ask_delivery');
        console.log(`Local Tomar Pedido tiene 'n_ask_delivery': ${hasNode}`);
    }

    const { data: nodeCheckVPS } = await vpsClient.from('flows').select('nodes').eq('name', 'pedido').limit(1).maybeSingle();
    if (nodeCheckVPS) {
        const hasNode = nodeCheckVPS.nodes.some(n => n.id === 'n_ask_delivery');
        console.log(`VPS pedido tiene 'n_ask_delivery': ${hasNode}`);
    }
}

compare();
