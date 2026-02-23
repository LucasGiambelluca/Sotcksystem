import 'dotenv/config';
import app from './api/app';
import { whatsappClient } from './infrastructure/whatsapp/WhatsAppClient';

const PORT = process.env.PORT || 3001;

async function bootstrap() {
    // 1. Start Server
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });

    // 2. Start Services (WhatsApp)
    try {
        await whatsappClient.start();
        console.log(`🤖 WhatsApp Client initialized successfully.`);
    } catch (error) {
        console.error('❌ Failed to initialize WhatsApp Client:', error);
    }
}

// Global error handling to prevent Baileys connection drops from taking down the whole Express server
process.on('uncaughtException', (err) => {
    console.error('🚨 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

bootstrap();
