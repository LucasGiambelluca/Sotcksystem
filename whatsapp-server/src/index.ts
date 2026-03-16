import 'dotenv/config';
import app from './api/app';
import { whatsappClient } from './infrastructure/whatsapp/WhatsAppClient';
import { stockCronService } from './services/StockCronService';
import { orderNotificationListener } from './services/OrderNotificationListener';

const PORT = process.env.PORT || 3001;

async function bootstrap() {
    // 1. Start Server
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });

    // 2. Start Services (WhatsApp)
    try {
        const isOfficial = !!(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

        if (isOfficial) {
            console.log(`🚀 [WhatsApp] Using Official Cloud API (No QR needed).`);
            // The official client doesn't need a .start() loop like Baileys
            // It works via outgoing HTTP and incoming Webhooks
        } else {
            console.log(`🤖 [WhatsApp] Using Baileys (Legacy QR-code system).`);
            await whatsappClient.start();
            console.log(`🤖 WhatsApp Client initialized successfully.`);
        }
        
        // Start Order Notification Listener
        orderNotificationListener.start();
        console.log(`🔔 Order Notification Listener started.`);
    } catch (error) {
        console.error('❌ Failed to initialize WhatsApp Client:', error);
    }

    // 3. Start Background Jobs
    stockCronService.start();
    console.log('📅 Background cron jobs started.');
}

// Global error handling to prevent Baileys connection drops from taking down the whole Express server
process.on('uncaughtException', (err) => {
    console.error('🚨 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

bootstrap();
