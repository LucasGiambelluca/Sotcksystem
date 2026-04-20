
import { OfficialWhatsAppClient } from './src/infrastructure/whatsapp/OfficialWhatsAppClient';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function test() {
    console.log('1. Starting test...');
    const client = new OfficialWhatsAppClient();
    try {
        console.log('2. Attempting to send message...');
        const result = await client.sendMessage('5492915093499', '🤖 Hola Lucas! Prueba desde script minimalista.');
        console.log('3. SUCCESS:', result);
    } catch (e: any) {
        console.error('3. ERROR:', e.message);
    }
}

test();
