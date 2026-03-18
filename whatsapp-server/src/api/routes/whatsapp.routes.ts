import { Router } from 'express';
import { whatsappClient } from '../../infrastructure/whatsapp/WhatsAppClient';
import { formatArgentinaPhone } from '../../utils/phoneFormatter';
import { supabase } from '../../config/database';

const router = Router();

// QR Code and Connection endpoints
router.get('/default/auth/qr', (req, res) => {
    const status = whatsappClient.getStatus();
    const qrCodeData = whatsappClient.getQrCode();

    if (status === 'WORKING') return res.json({ status: 'WORKING', message: 'Already connected' });
    if (qrCodeData) return res.json({ qr: qrCodeData });
    return res.status(422).json({ response: { status } });
});

router.post('/sessions/start', (req, res) => {
    const status = whatsappClient.getStatus();
    if (status === 'WORKING') return res.json({ status: 'WORKING' });
    if (status === 'STOPPED') whatsappClient.start();
    res.json({ status: 'STARTING' });
});

router.post('/sessions/logout', async (req, res) => {
    try {
        const result = await whatsappClient.logout();
        res.json(result);
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
});

// Single Message Sending API
router.post('/send-message', async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ error: 'Missing phone or message' });
    }

    try {
        const sanitizedPhone = formatArgentinaPhone(phone);
        const jid = `${sanitizedPhone}@s.whatsapp.net`;
        
        console.log(`📤 Enqueueing message to ${jid} via WhatsAppClient`);
        await whatsappClient.sendMessage(jid, { text: message });

        // Set conversation to HANDOVER mode so bot stops responding
        await supabase.from('whatsapp_conversations')
            .update({ status: 'HANDOVER', updated_at: new Date().toISOString() })
            .eq('phone', sanitizedPhone);
        // We'll proceed as if no session exists below
        
        // Also archive any active bot session
        await supabase.from('flow_executions')
            .update({ status: 'archived', archived_reason: 'manual_intervention' })
            .eq('phone', sanitizedPhone)
            .in('status', ['active', 'waiting_input']);

        res.json({ success: true, message: 'Message sent and handover activated' });
    } catch (error) {
        console.error('Error queueing message:', error);
        res.status(500).json({ error: 'Failed to queue message' });
    }
});

// Manual Handover Control
router.post('/take-control', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Missing phone' });

    try {
        const sanitizedPhone = formatArgentinaPhone(phone);
        
        // 1. Set status to HANDOVER
        await supabase.from('whatsapp_conversations')
            .update({ status: 'HANDOVER', updated_at: new Date().toISOString() })
            .eq('phone', sanitizedPhone);
            
        // 2. Archive active sessions
        await supabase.from('flow_executions')
            .update({ status: 'archived', archived_reason: 'manual_takeover' })
            .eq('phone', sanitizedPhone)
            .in('status', ['active', 'waiting_input']);

        res.json({ success: true, message: 'Bot muted, manual control activated' });
    } catch (error) {
        console.error('Error taking control:', error);
        res.status(500).json({ error: 'Failed to take control' });
    }
});

export default router;
