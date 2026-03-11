const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv');

const env = dotenv.parse(fs.readFileSync('.env'));
const url = new URL(env.VITE_SUPABASE_URL);
const key = env.VITE_SUPABASE_ANON_KEY;

const post = (path, data) => new Promise((resolve, reject) => {
  const options = {
    hostname: url.hostname,
    path: `/rest/v1${path}`,
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };
  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => resolve(JSON.parse(body)));
  });
  req.on('error', reject);
  req.write(JSON.stringify(data));
  req.end();
});

async function main() {
  try {
    const order = await post('/orders', {
      status: 'PENDING',
      total_amount: 3500.50,
      channel: 'WHATSAPP',
      phone: '549111222333',
      delivery_address: 'Calle de Prueba 123',
      delivery_type: 'DELIVERY',
      chat_context: { pushName: 'Prueba de Alerta' }
    });

    const orderId = order[0].id;
    await post('/order_items', [
      { order_id: orderId, catalog_item_id: 'b75950d4-cbc7-48a8-9f2f-629ef435e341', quantity: 2, unit_price: 1000, subtotal: 2000 },
      { order_id: orderId, catalog_item_id: '1bc3c243-b245-4750-b229-89517e5541c7', quantity: 1, unit_price: 1500.50, subtotal: 1500.50 }
    ]);

    console.log(`SUCCESS: Order #${order[0].order_number} created.`);
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}

main();
