
import { ConversationRouter } from '../src/core/engine/conversation.router';

// Mock Adapter
class MockAdapter {
    async sendMessage(to: string, content: any) {
        console.log(`[MOCK] Sending message to ${to}:`, JSON.stringify(content, null, 2));
    }
}

// Mock Context
const mockContext = {
    userId: '1234567890@s.whatsapp.net',
    cart: [],
    history: []
};

// Mock Message
const mockMessage = {
    key: {
        remoteJid: '1234567890@s.whatsapp.net',
        fromMe: false,
        id: 'TEST_MSG_ID'
    },
    message: {
        conversation: 'Hola'
    },
    pushName: 'Test User'
};

async function run() {
    console.log('Starting manual simulation...');
    const adapter = new MockAdapter() as any;
    const router = new ConversationRouter(adapter);

    console.log('Routing "Hola"...');
    await router.routeMessage(mockMessage, mockContext);
    
    console.log('Sending "Menu"...');
    mockMessage.message.conversation = 'menu';
    await router.routeMessage(mockMessage, mockContext);
}

run();
