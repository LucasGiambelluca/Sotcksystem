import { supabase } from '../config/database';

async function cleanup() {
  console.log('--- CLEANING UP STATIONS ---');
  
  // 1. Get all stations
  const { data: stations } = await supabase.from('stations').select('*').order('created_at');
  if (!stations) return;

  const uniqueStations: Record<string, string> = {}; // name -> first_id
  const duplicateIds: string[] = [];
  const remap: Record<string, string> = {}; // old_id -> new_id

  stations.forEach(s => {
    if (!uniqueStations[s.name]) {
      uniqueStations[s.name] = s.id;
    } else {
      duplicateIds.push(s.id);
      remap[s.id] = uniqueStations[s.name];
    }
  });

  console.log(`Found ${duplicateIds.length} duplicate stations to remove.`);

  // 2. Remap catalog_items
  for (const [oldId, newId] of Object.entries(remap)) {
    const { error: updateErr } = await supabase
      .from('catalog_items')
      .update({ station_id: newId })
      .eq('station_id', oldId);
    if (updateErr) console.error(`Error remapping catalog items from ${oldId} to ${newId}:`, updateErr);
  }

  // 3. Delete duplicates
  if (duplicateIds.length > 0) {
    const { error: delErr } = await supabase.from('stations').delete().in('id', duplicateIds);
    if (delErr) console.error('Error deleting duplicate stations:', delErr);
    else console.log('Successfully deleted duplicates.');
  }

  // 4. Create fresh test orders
  console.log('--- CREATING FRESH TEST ORDERS ---');
  const { data: items } = await supabase.from('catalog_items').select('*, stations(*)').limit(2);
  const { data: client } = await supabase.from('clients').select('*').limit(1).single();

  const statuses = ['PENDING', 'IN_PREPARATION'];
  for (const status of statuses) {
    const total = items?.reduce((sum, i) => sum + i.price, 0) || 0;
    const { data: order, error: orderErr } = await supabase.from('orders').insert({
      client_id: client?.id,
      status: status,
      total_amount: total,
      channel: 'WHATSAPP',
      phone: client?.phone || '549291000000',
      delivery_address: 'Calle Test 123',
      delivery_type: 'DELIVERY',
      chat_context: { pushName: `Test ${status}` }
    }).select().single();

    if (order && items) {
       const orderItems = items.map(i => ({
         order_id: order.id,
         catalog_item_id: i.id,
         quantity: 1,
         unit_price: i.price,
         subtotal: i.price
       }));
       await supabase.from('order_items').insert(orderItems);
       console.log(`✅ Order #${order.order_number} [${status}] created.`);
    }
  }
}

cleanup();
