const { createClient } = require('@supabase/supabase-client');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function fixSchema() {
  console.log('--- Applying Schema Fix for flow_executions ---');
  
  const sql = `
    ALTER TABLE flow_executions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    ALTER TABLE flow_executions_history ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
  `;

  try {
    // Attempting to use the RPC for SQL if available, or just notify user
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
       console.error('Error via RPC:', error);
       console.log('\nPlease run the following SQL manually in the Supabase SQL Editor:');
       console.log(sql);
    } else {
       console.log('✅ Successfully applied columns via RPC.');
    }
  } catch (err) {
    console.error('Catch Error:', err);
    console.log('\nPlease run the following SQL manually in the Supabase SQL Editor:');
    console.log(sql);
  }
}

fixSchema();
