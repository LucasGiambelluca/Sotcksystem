require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function clearData() {
    console.log('🧹 Clearing all application data...');
    const tables = [
        'order_items',
        'route_orders',
        'whatsapp_messages',
        'whatsapp_conversations',
        'orders',
        'routes',
        'products',
        'categories',
        'chat_sessions',
        'lid_mappings',
        'clients',
        'bot_settings'
    ];

    for (const table of tables) {
        process.stdout.write(`Deleting from ${table}... `);
        // Attempt to delete all rows (where id or another column is not null)
        // Since we don't know the PK of every table, we try to delete where created_at is not null, or id is not null.
        // Or simply drop and recreate? No, that requires admin.
        try {
            const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) {
                // Try with phone for chat_sessions
                const { error: err2 } = await supabase.from(table).delete().neq('phone', '0');
                if (err2) {
                     // Try with lid for lid_mappings
                     const { error: err3 } = await supabase.from(table).delete().neq('lid', '0');
                     if (err3) {
                         console.log(`❌ Failed: ${error.message}`);
                     } else console.log(`✅ (lid)`);
                } else console.log(`✅ (phone)`);
            } else {
                console.log(`✅`);
            }
        } catch (e) {
             console.log(`❌ Crashed: ${e.message}`);
        }
    }
    console.log('✨ Data reset attempt completed.');
}

clearData();
