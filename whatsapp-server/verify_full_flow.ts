
import { EntityExtractor } from './src/core/nlu/EntityExtractor';
import { OrderInterpreter } from './src/core/nlu/OrderInterpreter';
import { ConversationRouter } from './src/core/engine/conversation.router';
import { supabase } from './src/config/database';
import 'dotenv/config';

async function testFullFlow() {
    const extractor = new EntityExtractor();
    const interpreter = new OrderInterpreter(extractor);
    const router = new ConversationRouter();
    await extractor.loadCatalog();

    const phone = '5491100000009';
    const text1 = "quiero un pollo con fritas y una coca cola";
    
    console.log(`\n--- Step 1: Input "${text1}" ---`);
    const nlu1 = await interpreter.interpret(text1);
    console.log('Parsed Items:', nlu1.parsedOrder?.items.map(i => `${i.quantity}x ${i.productName}`));

    // In a real router, it would create a draft. Let's mock the draft or use the real one.
    // We'll create it manually to simulate the router's behavior in handleNluDirectOrder
    const items = nlu1.parsedOrder?.items.map(i => ({
        qty: i.quantity,
        name: i.productName,
        price: i.basePrice,
        catalog_item_id: i.productId
    }));
    
    const { data: draft } = await supabase.from('draft_orders').insert({
        phone,
        items,
        total: items?.reduce((s, i) => s + (i.price * i.qty), 0),
        status: 'pending_override'
    }).select().single();

    console.log('Draft created with:', draft.items.length, 'items');

    const text2 = "quitar el pollo a la parilla con fritas";
    console.log(`\n--- Step 2: Input "${text2}" ---`);
    
    // We need to use handleOverrideResponse to test the logic
    const response = await (router as any).handleOverrideResponse(phone, text2, {}, 'Test User');
    console.log('Bot Response:', response[0]);

    const { data: updatedDraft } = await supabase.from('draft_orders').select('*').eq('id', draft.id).single();
    console.log('Final Items:', updatedDraft.items.map((i:any) => `${i.qty}x ${i.name}`));
    console.log('Final Total:', updatedDraft.total);

    // Cleanup
    await supabase.from('draft_orders').delete().eq('id', draft.id);
}

testFullFlow().catch(console.error);
