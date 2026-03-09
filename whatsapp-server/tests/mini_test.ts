
import router from '../src/core/engine/conversation.router';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log('--- MINI TEST START ---');
    try {
        const responses = await router.processMessage('12345', 'hola', 'Tester');
        console.log('Responses:', responses);
    } catch (e) {
        console.error('CRASH:', e);
    }
    console.log('--- MINI TEST END ---');
}

run();
