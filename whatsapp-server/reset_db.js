const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function clearData() {
    console.log('🧹 Clearing data...');

    // Clear LID mappings
    const { error: lidError } = await supabase.from('lid_mappings').delete().neq('lid', '0');
    if (lidError) console.error('Error clearing LID mappings:', lidError); else console.log('✅ lid_mappings cleared');

    // Clear Messages
    const { error: msgError } = await supabase.from('whatsapp_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (hacky neq check for all)
    // Actually, delete() without filters is risky unless RLS allows it? Usually requires at least one filter.
    // Let's use conversation_id is not null?
    // Or just truncate via SQL if possible?
    // Supabase JS delete requires filter.
    
    // Clear Sessions
    const { error: sessError } = await supabase.from('chat_sessions').delete().neq('phone', '0');
    if (sessError) console.error('Error clearing sessions:', sessError); else console.log('✅ chat_sessions cleared');

    // Clear Conversations? Messages have FK to conversations.
    // If we delete conversations, messages should cascade if configured?
    // Let's delete conversations explicitly.
    // First need to empty messages.
    // Let's try to delete all messages Where id is not null?
    const { error: msgError2 } = await supabase.from('whatsapp_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (msgError2) console.error('Error clearing messages:', msgError2); else console.log('✅ whatsapp_messages cleared');
    
    const { error: convoError } = await supabase.from('whatsapp_conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (convoError) console.error('Error clearing conversations:', convoError); else console.log('✅ whatsapp_conversations cleared');

    console.log('✨ Done.');
}

clearData();
