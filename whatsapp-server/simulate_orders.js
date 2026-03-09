const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function simulateOrders() {
    console.log('🚀 Iniciando simulación de 10 pedidos...');

    // 1. Obtener algunos items del catálogo
    const { data: items, error: itemsError } = await supabase
        .from('catalog_items')
        .select('id, name, price')
        .eq('is_active', true)
        .limit(5);

    if (itemsError || !items || items.length === 0) {
        console.error('❌ No se encontraron items en el catálogo:', itemsError);
        return;
    }

    console.log(`✅ Usando items: ${items.map(i => i.name).join(', ')}`);

    const names = ['Lucas', 'Martin', 'Giambelluca', 'Ana', 'Beto', 'Carla', 'Diego', 'Elena', 'Fede', 'Gabi'];
    
    for (let i = 1; i <= 10; i++) {
        const name = names[i-1] || `Cliente ${i}`;
        const phone = `549291${Math.floor(1000000 + Math.random() * 9000000)}`;
        
        // Seleccionar 1 o 2 items al azar
        const numItems = Math.floor(Math.random() * 2) + 1;
        const selectedItems = [];
        let total = 0;
        
        for (let j = 0; j < numItems; j++) {
            const item = items[Math.floor(Math.random() * items.length)];
            const qty = Math.floor(Math.random() * 3) + 1;
            selectedItems.push({
                catalog_item_id: item.id,
                quantity: qty,
                unit_price: item.price,
                name: item.name
            });
            total += item.price * qty;
        }

        console.log(`📝 Creando pedido ${i}/10 para ${name}...`);

        // Insertar Orden
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                phone: phone,
                total_amount: total,
                status: 'PENDING',
                delivery_type: Math.random() > 0.5 ? 'DELIVERY' : 'PICKUP',
                delivery_address: 'Calle Falsa 123',
                chat_context: { pushName: name }
            })
            .select()
            .single();

        if (orderError) {
            console.error(`❌ Error al crear orden ${i}:`, orderError.message);
            continue;
        }

        // Insertar Items de la orden
        const itemsToInsert = selectedItems.map(item => ({
            order_id: order.id,
            catalog_item_id: item.catalog_item_id,
            quantity: item.quantity,
            unit_price: item.unit_price
        }));

        const { error: itemsInsertError } = await supabase
            .from('order_items')
            .insert(itemsToInsert);

        if (itemsInsertError) {
            console.error(`❌ Error al insertar items para orden ${i}:`, itemsInsertError.message);
        } else {
            console.log(`✅ Pedido #${order.order_number} creado con éxito.`);
        }

        // Esperar 2 segundos entre pedidos (para completar 10 en ~20-30 seg)
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('✨ Simulación finalizada.');
}

simulateOrders();
