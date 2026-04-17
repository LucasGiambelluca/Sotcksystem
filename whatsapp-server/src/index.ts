import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });

import app from './api/app';
import { whatsappClient } from './infrastructure/whatsapp/WhatsAppClient';
import { stockCronService } from './services/StockCronService';
import { notificationService } from './services/NotificationService';
import { PrinterBridgeService } from './services/PrinterBridgeService';
import { sessionCleanupService } from './services/SessionCleanupService';
import { tokenRefreshJob } from './services/TokenRefreshJob';

const PORT = process.env.PORT || 3001;

async function bootstrap() {
    // 1. Start Server
    app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });

    try {
        // 🔔 [StockSystem Notify v2.1] - Inicialización de Bots
        const isOfficial = !!(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
        
        await notificationService.registerBot({
            botId: process.env.BOT_ID || 'eldelirio',
            phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
            accessToken: process.env.WHATSAPP_CLOUD_TOKEN,
            catalogSlug: process.env.CATALOG_SLUG || 'eldelirio',
            maxConcurrentJobs: Number(process.env.MAX_CONCURRENT_JOBS) || 3,
            messagesPerMinute: Number(process.env.MESSAGES_PER_MINUTE) || 80,
            isLocal: !isOfficial
        });

        if (isOfficial) {
            console.log(`🚀 [WhatsApp] Using Official Cloud API (No QR needed).`);
        } else {
            console.log(`🤖 [WhatsApp] Using Baileys (Legacy QR-code system).`);
            await whatsappClient.start();
        }
    } catch (error) {
        console.error('❌ [CRITICAL] Failed to initialize Notification System or WhatsApp Client:', error);
    }

    // 2b. Start Printer Bridge (Queue worker)
    PrinterBridgeService.getInstance().start();

    // 3. Start Background Jobs
    stockCronService.start();
    tokenRefreshJob.start();
    console.log('📅 Background cron jobs started.');

    // 4. Diagnostic Pulse (Verify 'Tomar Pedido' flow)
    setTimeout(async () => {
        try {
            const { supabase } = require('./config/database');
            const { data: flows } = await supabase.from('flows')
                .select('id, name, nodes')
                .or('name.eq.Tomar Pedido,trigger_word.eq.pedido')
                .limit(1);

            if (flows && flows.length > 0) {
                console.log(`\n🔍 [Startup Pulse] Flow "${flows[0].name}" (${flows[0].id}) found with ${flows[0].nodes?.length || 0} nodes:`);
                flows[0].nodes?.forEach((n: any) => {
                    const label = n.data?.label || n.data?.text || n.data?.question || 'N/A';
                    console.log(`   - ID: ${n.id} | Type: ${n.type} | Info: ${label.substring(0, 30)}...`);
                });
                console.log('--- End of Pulse ---\n');
            } else {
                console.log('🔍 [Startup Pulse] Flow "Tomar Pedido" not found for diagnostic.');
            }
        } catch (e) {
            console.error('🔍 [Startup Pulse] Diagnostic failed:', e);
        }
    }, 5000);
}

// Global error handling to prevent Baileys connection drops from taking down the whole Express server
process.on('uncaughtException', (err) => {
    console.error('🚨 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

bootstrap();
