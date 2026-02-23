
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../whatsapp-server/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function clean() {
  console.log('🧹 Cleaning WhatsApp Data...');

  try {
    const { error: sessErr } = await supabase.from('chat_sessions').delete().neq('id', 0); // Delete all
    if (sessErr) console.error('Error cleaning sessions:', sessErr);

    const { error: msgErr } = await supabase.from('whatsapp_messages').delete().neq('id', 0);
    if (msgErr) console.error('Error cleaning messages:', msgErr);

    const { error: convErr } = await supabase.from('whatsapp_conversations').delete().neq('id', 0);
    if (convErr) console.error('Error cleaning conversations:', convErr);

    console.log('✅ Chat history cleared.');

    // Optionally create a clean slate for clients? No, let's keep them but wipe specific one if needed.
    // We'll assume just clearing conversations is enough for testing flow.

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

clean();
