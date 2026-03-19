
import { EntityExtractor } from './src/core/nlu/EntityExtractor';
import { OrderInterpreter } from './src/core/nlu/OrderInterpreter';
import { ConversationRouter } from './src/core/engine/conversation.router';
import { supabase } from './src/config/database';
import 'dotenv/config';

async function testInquiries() {
    const extractor = new EntityExtractor();
    const interpreter = new OrderInterpreter(extractor);
    const router = new ConversationRouter();
    await extractor.loadCatalog();

    const phone = '5491100000099';
    
    console.log('\n--- Case 1: Product Inquiry ("tenes tarta de jamon y queso?") ---');
    const text1 = "tenes tarta de jamon y queso?";
    const nlu1 = await interpreter.interpret(text1);
    console.log('Intent:', nlu1.type);
    const resp1 = await router.processMessage(phone, text1, 'Test User', {});
    console.log('Bot Response:', resp1[0]);

    console.log('\n--- Case 2: Follow-up Order ("si, anotame uno") ---');
    // We'll just run the next message, the router will fetch the session from DB
    const text2 = "si, anotame uno";
    const resp2 = await router.processMessage(phone, text2, 'Test User', {});
    console.log('Bot Response:', resp2[0]);
    console.log('Bot Response:', resp2[0]);

    console.log('\n--- Case 3: Category Inquiry ("que variedades de empanadas tenes?") ---');
    const text3 = "que variedades de empanadas tenes?";
    const nlu3 = await interpreter.interpret(text3);
    console.log('Intent:', nlu3.type);
    const resp3 = await router.processMessage(phone, text3, 'Test User', {});
    console.log('Bot Response:', resp3[0]);

    // Cleanup: delete the draft created in Case 2
    await supabase.from('draft_orders').delete().eq('phone', phone);
}

testInquiries().catch(console.error);
