const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
});

async function main() {
  try {
    console.log('Connecting to Supabase Postgres...');
    await client.connect();
    
    console.log('Enabling realtime on orders...');
    // We can use DO block to prevent errors if already added
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 
          FROM pg_publication_tables 
          WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
        ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE orders;
        END IF;
      END $$;
    `);
    
    console.log('Success: Orders table now part of supabase_realtime.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
