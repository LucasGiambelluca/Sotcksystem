const { createClient } = require('@supabase/supabase-js');

// VPS Credentials (from user logs and previous turns)
const URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';
const supabase = createClient(URL, KEY);

const MY_SLUG = 'elpollocomilon';
const MY_BOT_ID = '1076716382182500';

const lastStatusCheck = new Map();
let lastPollTime = new Date(Date.now() - 300000).toISOString(); // 5 min ago

async function runDiagnostic() {
    console.log(`--- Diagnóstico Listener v2.3 (Simulando VPS) ---`);
    console.log(`Buscando actividad desde: ${lastPollTime}`);

    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, status, order_number, updated_at, chat_context, out_at, assigned_at')
        .order('updated_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error en consulta:', error);
        return;
    }

    console.log(`Órdenes encontradas: ${orders.length}`);

    for (const order of orders) {
        const chatContext = order.chat_context || {};
        const isMyOrder = 
            (chatContext.catalog_slug === MY_SLUG) || 
            (chatContext.bot_id === MY_BOT_ID);

        console.log(`\nPedido #${order.order_number} (${order.status})`);
        console.log(`- Pertenece a este bot: ${isMyOrder ? 'SÍ' : 'NO'}`);
        console.log(`- updated_at: ${order.updated_at}`);
        console.log(`- out_at: ${order.out_at}`);
        console.log(`- chat_context.catalog_slug: ${chatContext.catalog_slug}`);
        
        if (isMyOrder && (order.status === 'DELIVERED' || order.status === 'COMPLETED')) {
            const hasOutAt = !!(order.out_at || order.assigned_at);
            console.log(`- [CHECK REPLAY] ¿Tiene out_at/assigned_at?: ${hasOutAt ? 'SÍ' : 'NO'}`);
            if (!hasOutAt) {
                console.log(`  ⚠ ADVERTENCIA: Este pedido no tiene marca de salida. El aviso "Pedido Enviado" NUNCA se enviará como replay.`);
            }
        }
    }
}

runDiagnostic();
