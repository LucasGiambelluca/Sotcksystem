require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('--- DEBUGEANDO QUERY KITCHEN ---');
    
    // Exact SQL from KitchenDashboard.tsx
    const { data, error } = await supabase
        .from('orders')
        .select(`
            id, order_number, status, delivery_address,
            client:clients(name),
            order_items(
                id, quantity, unit_price, catalog_item_id, product_id,
                catalog_item:catalog_items(name)
            )
        `)
        .not('status', 'in', '(DELIVERED,CANCELLED,OUT_FOR_DELIVERY,PICKED_UP)')
        .order('created_at', { ascending: false })
        .limit(50);
    
    if (error) {
        console.error('Error en Query:', error);
        return;
    }

    console.log(`Pedidos encontrados: ${data.length}`);
    if (data.length > 0) {
        data.forEach(o => {
            console.log(`[#${o.order_number}] Status: ${o.status} | Cliente: ${o.client?.name || 'N/A'}`);
        });
    } else {
        console.log('No se devolvieron pedidos. Probando sin el filtro .not(...)');
        const { data: all } = await supabase.from('orders').select('id, order_number, status').limit(5);
        console.log('Muestra de estados en la DB:', all.map(a => a.status).join(', '));
    }

  } catch (err) {
    console.error('Error inesperado:', err);
  }
}

main();
