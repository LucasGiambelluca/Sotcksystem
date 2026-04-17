const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:stock2025aA@db.bomzcidnpslryfgnrsrs.supabase.co:5432/postgres';

async function run() {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    
    try {
        const res = await client.query(`
            SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
            FROM pg_policies 
            WHERE tablename = 'orders';
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
