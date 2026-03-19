import 'dotenv/config';
import conversationRouter from './src/core/engine/conversation.router';
import { supabase } from './src/config/database';

async function diagnose() {
    const phone = '5491100000099';
    const pushName = 'Diagnose User';
    
    console.log('--- Step 1: Product Inquiry ---');
    const r1 = await conversationRouter.processMessage(phone, 'tenes coca cola?', pushName, {});
    console.log('R1:', JSON.stringify(r1, null, 2));

    console.log('\n--- Step 2: Confirmation (SI) ---');
    const r2 = await conversationRouter.processMessage(phone, 'si, anotame uno', pushName, {});
    console.log('R2:', JSON.stringify(r2, null, 2));

    process.exit(0);
}

diagnose();
