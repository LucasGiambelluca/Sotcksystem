const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
});

async function main() {
  try {
    await client.connect();
    
    console.log('\n--- WHATSAPP CONFIG ---');
    const configRes = await client.query(`SELECT checkout_message FROM whatsapp_config LIMIT 1;`);
    console.log(configRes.rows[0]?.checkout_message);

    console.log('\n--- LAST 10 WA MESSAGES ---');
    const msgRes = await client.query(`SELECT direction, content, created_at FROM whatsapp_messages ORDER BY created_at DESC LIMIT 10;`);
    msgRes.rows.forEach(r => console.log(`[${r.direction}] at ${r.created_at}: ${r.content.slice(0, 100).replace(/\n/g, '\\n')}`));

    console.log('\n--- LAST 5 ORDERS ---');
    const orderRes = await client.query(`SELECT id, phone, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5;`);
    orderRes.rows.forEach(r => console.log(`Order ${r.id.slice(0, 8)} (${r.status}) from ${r.phone} at ${r.created_at}`));
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
