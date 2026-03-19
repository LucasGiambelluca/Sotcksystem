
import { supabase } from './src/config/database';
import 'dotenv/config';

async function checkDrafts() {
    const { data } = await supabase.from('draft_orders').select('*').order('created_at', { ascending: false }).limit(1).single();
    if (data) {
        console.log('Draft ID:', data.id);
        console.log('Status:', data.status);
        console.log('Items:', JSON.stringify(data.items, null, 2));
    } else {
        console.log('No drafts found');
    }
}

checkDrafts().catch(console.error);
