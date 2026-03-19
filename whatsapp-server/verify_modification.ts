
import { ConversationRouter } from './src/core/engine/conversation.router';
import { supabase } from './src/config/database';
import 'dotenv/config';

async function testModification() {
    const router = new ConversationRouter();
    // No need to load NLU, it loads on demand or we can mock it
    // But since it's a test, let's just use the real extractor if possible
    
    const phone = '5491100000001';
    
    console.log('--- Setting up test draft order ---');
    const { data: draft } = await supabase.from('draft_orders').insert({
        phone,
        push_name: 'Test User',
        status: 'pending_override',
        total: 44644,
        items: [
            { qty: 1, name: 'Pollo a la parrilla con fritas', price: 35000, catalog_item_id: '93a692df-01f1-40fd-9a48-d93de4e13975' },
            { qty: 1, name: 'Pure de Papas', price: 9644, catalog_item_id: 'b9b300c4-d93a-42c7-b5bf-cde3b2f352e5' }
        ]
    }).select().single();

    if (!draft) {
        console.error('Failed to create draft');
        return;
    }

    console.log('Draft created with ID:', draft.id);

    console.log('\n--- Simulating removal of "pure de papas" ---');
    const response = await (router as any).handleOverrideResponse(phone, 'quitar el pure de papas', {}, 'Test User');
    console.log('Bot Response:', response);

    console.log('\n--- Checking updated draft ---');
    const { data: updatedDraft } = await supabase.from('draft_orders').select('*').eq('id', draft.id).single();
    console.log('Updated Items:', JSON.stringify(updatedDraft.items, null, 2));
    console.log('Updated Total:', updatedDraft.total);

    // Cleanup
    await supabase.from('draft_orders').delete().eq('id', draft.id);
}

testModification().catch(console.error);
