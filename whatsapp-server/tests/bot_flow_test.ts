
import router from '../src/core/engine/conversation.router';
import { supabase } from '../src/config/database';
import * as dotenv from 'dotenv';
dotenv.config();

const PHONE = '542914160868';
const PUSH_NAME = 'Lucas Test';

async function simulate(text: string, context: any = {}) {
    console.log(`\n[USER] ${PHONE}: "${text}"`);
    const responses = await router.processMessage(PHONE, text, PUSH_NAME, context);
    for (const res of responses) {
        const display = typeof res === 'object' ? JSON.stringify(res) : res;
        console.log(`[BOT] : ${display}`);
    }
    return responses;
}

async function runTests() {
    console.log('🚀 Starting Bot Flow Integration Tests...');

    try {
        // 1. Test: Greetings
        await simulate('hola');

        // 2. Test: Catalog Order Simulation (Raw Format)
        // This simulates a user typing "Product xN" manually or an old catalog message
        await simulate('7 up 1 1/2 x1 — $5.900\nTotal: $5.900');

        // 3. Test: Catalog Order with Metadata (The fix we just applied)
        const metadataMessage = `Nombre: Lucas Test | Delivery: Delivery | Pago: Efectivo
🛒 *Hola! Quiero hacer el siguiente pedido:*

• *7 up 1 1/2* x1 — $5.900

*Total: $5.900*`;
        
        await simulate(metadataMessage);

        // 4. Test: Confirmation of Catalog Order (if session exists)
        // If the previous test triggered a "pending_override", we test "si"
        await simulate('si');

        console.log('\n✅ Tests completed.');
    } catch (err) {
        console.error('\n❌ Test Suite Failed:', err);
    }
}

runTests();
