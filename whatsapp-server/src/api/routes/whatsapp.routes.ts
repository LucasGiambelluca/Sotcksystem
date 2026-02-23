import { Router } from 'express';
import { whatsappClient } from '../../infrastructure/whatsapp/WhatsAppClient';

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
    const sock = whatsappClient.getSock();
    const { phone, message } = req.body;

    if (!sock) {
        return res.status(503).json({ error: 'WhatsApp service not ready' });
    }

    if (!phone || !message) {
        return res.status(400).json({ error: 'Missing phone or message' });
    }

    try {
        let jid: string;
        if (phone.includes('@lid')) {
            jid = phone;
        } else if (phone.includes('@')) {
            jid = phone.replace('@c.us', '@s.whatsapp.net');
        } else {
            jid = `${phone}@s.whatsapp.net`;
        }
        
        console.log(`📤 Sending message to ${jid}`);
        await sock.sendMessage(jid, { text: message });
        console.log(`✅ Message sent to ${jid}`);
        res.json({ success: true, message: 'Message sent' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

export default router;
