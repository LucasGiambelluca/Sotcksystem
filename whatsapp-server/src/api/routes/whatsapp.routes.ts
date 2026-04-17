import { Router } from 'express';
import { whatsappClient } from '../../infrastructure/whatsapp/WhatsAppClient';
import { officialWhatsAppClient } from '../../infrastructure/whatsapp/OfficialWhatsAppClient';
import { PhoneUtils } from '../../utils/phoneUtils';
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

// =============================================================
// Single Message Sending API (Panel → Customer)
// The phone comes directly from the DB (may be LID or regular).
// PhoneUtils.toJid handles both formats correctly.
// =============================================================
router.post('/send-message', async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ error: 'Missing phone or message' });
    }

    try {
        const jid = PhoneUtils.toJid(phone);
        
        console.log(`📤 [send-message] Sending to ${jid} (db phone: ${phone})`);
        
        // 1. Send the message via WhatsApp
        await whatsappClient.sendMessage(jid, { text: message });

        // 2. Check the CURRENT status of the conversation
        const { data: convo } = await supabase.from('whatsapp_conversations')
            .select('status')
            .eq('phone', phone)
            .maybeSingle();

        // 3. Only pause the bot if it's not already paused
        if (!convo || convo.status !== 'HANDOVER') {
            await supabase.from('whatsapp_conversations')
                .update({ status: 'HANDOVER', updated_at: new Date().toISOString() })
                .eq('phone', phone);

            await supabase.from('flow_executions')
                .update({ status: 'archived', archived_reason: 'manual_intervention' })
                .eq('phone', phone)
                .in('status', ['active', 'waiting_input']);
            
            console.log(`🔒 [send-message] Bot paused for ${phone} (was: ${convo?.status || 'none'})`);
        }

        res.json({ success: true, message: 'Message sent' });
    } catch (error: any) {
        console.error('❌ [send-message] Error:', error.message || error);
        res.status(500).json({ error: `Failed to send: ${error.message || 'Unknown error'}` });
    }
});

// =============================================================
// Manual Handover Control (Panel takes over from bot)
// =============================================================
router.post('/take-control', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Missing phone' });

    try {
        // Use phone as-is (it comes from the DB via frontend)
        await supabase.from('whatsapp_conversations')
            .update({ status: 'HANDOVER', updated_at: new Date().toISOString() })
            .eq('phone', phone);
            
        await supabase.from('flow_executions')
            .update({ status: 'archived', archived_reason: 'manual_takeover' })
            .eq('phone', phone)
            .in('status', ['active', 'waiting_input']);

        console.log(`🔒 [take-control] Bot muted for ${phone}`);
        res.json({ success: true, message: 'Bot muted, manual control activated' });
    } catch (error) {
        console.error('Error taking control:', error);
        res.status(500).json({ error: 'Failed to take control' });
    }
});

// =============================================================
// Resolve Handover — return control to bot
// =============================================================
router.post('/resolve-handover', async (req, res) => {
    const { phone, conversationId } = req.body;
    if (!phone && !conversationId) return res.status(400).json({ error: 'Missing phone or conversationId' });

    try {
        // 1. Set conversation status back to BOT
        if (conversationId) {
            await supabase.from('whatsapp_conversations')
                .update({ status: 'BOT', updated_at: new Date().toISOString() })
                .eq('id', conversationId);
        } else if (phone) {
            await supabase.from('whatsapp_conversations')
                .update({ status: 'BOT', updated_at: new Date().toISOString() })
                .eq('phone', phone);
        }

        // 2. Archive any remaining flow executions
        if (phone) {
            await supabase.from('flow_executions')
                .update({ status: 'archived', archived_reason: 'handover_resolved' })
                .eq('phone', phone)
                .in('status', ['HANDOVER', 'active', 'waiting_input']);
        }

        console.log(`✅ [resolve-handover] Bot resumed for ${phone || conversationId}`);
        res.json({ success: true, message: 'Bot control restored' });
    } catch (error) {
        console.error('Error resolving handover:', error);
        res.status(500).json({ error: 'Failed to resolve handover' });
    }
});

// =============================================================
// Broadcast — send a message to multiple individual contacts
// =============================================================
router.post('/broadcast', async (req, res) => {
    const { phones, message } = req.body;

    if (!phones || !Array.isArray(phones) || phones.length === 0 || !message) {
        return res.status(400).json({ error: 'Missing phones array or message' });
    }

    if (phones.length > 200) {
        return res.status(400).json({ error: 'Maximum 200 recipients per broadcast' });
    }

    let sent = 0;
    let failed = 0;

    const jobId = `broadcast-${Date.now()}`;
    res.json({ success: true, jobId, total: phones.length, message: 'Broadcast started' });

    for (const rawPhone of phones) {
        try {
            const jid = PhoneUtils.toJid(rawPhone);
            await whatsappClient.sendMessage(jid, { text: message });
            sent++;
            console.log(`📢 [Broadcast ${jobId}] Sent ${sent}/${phones.length}`);

            const delay = 2000 + Math.random() * 2000;
            await new Promise(resolve => setTimeout(resolve, delay));
        } catch (err: any) {
            failed++;
            console.error(`📢 [Broadcast ${jobId}] Failed for ${rawPhone}: ${err.message}`);
        }
    }

    console.log(`📢 [Broadcast ${jobId}] Complete: ${sent} sent, ${failed} failed out of ${phones.length}`);
});

// =============================================================
// Meta API Configuration (Official WhatsApp Cloud API)
// =============================================================

// GET current Meta API config (token masked for security)
router.get('/meta-config', async (req, res) => {
    try {
        const { data: configs } = await supabase
            .from('whatsapp_config')
            .select('meta_cloud_token, meta_phone_number_id, meta_app_secret, meta_verify_token')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1);

        const config = configs && configs.length > 0 ? configs[0] : null;

        res.json({
            configured: !!(config?.meta_cloud_token && config?.meta_phone_number_id),
            phone_number_id: config?.meta_phone_number_id || '',
            verify_token: config?.meta_verify_token || 'SotckSystemToken2026',
            // Mask the token for display: show first 10 chars + "..."
            token_preview: config?.meta_cloud_token 
                ? config.meta_cloud_token.substring(0, 10) + '...' 
                : '',
            has_app_secret: !!config?.meta_app_secret,
            // Also check .env fallback
            env_configured: !!(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
        });
    } catch (error: any) {
        console.error('Error reading meta config:', error);
        res.status(500).json({ error: 'Failed to read config' });
    }
});

// POST save Meta API credentials
router.post('/meta-config', async (req, res) => {
    const { cloud_token, phone_number_id, app_secret, verify_token } = req.body;

    if (!cloud_token || !phone_number_id) {
        return res.status(400).json({ error: 'Se requiere Cloud Token y Phone Number ID' });
    }

    try {
        // Get active config row
        const { data: configs } = await supabase
            .from('whatsapp_config')
            .select('id')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1);

        const updateData: any = {
            meta_cloud_token: cloud_token.trim(),
            meta_phone_number_id: phone_number_id.trim(),
            meta_verify_token: (verify_token || 'SotckSystemToken2026').trim(),
        };

        // Only update app_secret if provided (don't clear existing one)
        if (app_secret) {
            updateData.meta_app_secret = app_secret.trim();
        }

        if (configs && configs.length > 0) {
            await supabase.from('whatsapp_config')
                .update(updateData)
                .eq('id', configs[0].id);
        } else {
            // No config row exists, create one
            await supabase.from('whatsapp_config')
                .insert({ ...updateData, is_active: true });
        }

        // Clear cached credentials in the OfficialWhatsAppClient
        officialWhatsAppClient.clearCredentialCache();

        console.log(`✅ [meta-config] Meta API credentials saved. Phone ID: ${phone_number_id}`);
        res.json({ success: true, message: 'Credenciales guardadas' });
    } catch (error: any) {
        console.error('Error saving meta config:', error);
        res.status(500).json({ error: 'Failed to save config' });
    }
});

// POST test Meta API credentials
router.post('/meta-config/test', async (req, res) => {
    const { cloud_token, phone_number_id } = req.body;

    if (!cloud_token || !phone_number_id) {
        return res.status(400).json({ valid: false, error: 'Se requiere Cloud Token y Phone Number ID' });
    }

    try {
        const result = await officialWhatsAppClient.testCredentials(cloud_token.trim(), phone_number_id.trim());
        
        if (result.valid && result.phone) {
            const { ConfigurationService } = require('../../services/ConfigurationService');
            ConfigurationService.syncBotPhoneNumber(result.phone).catch(console.error);
        }

        res.json(result);
    } catch (error: any) {
        res.json({ valid: false, error: error.message });
    }
});

// POST Meta Embedded Signup callback (Official flow)
router.post('/embedded-signup', async (req, res) => {
    const { metaSignupController } = require('../controllers/MetaSignupController');
    return metaSignupController.handleEmbeddedSignup(req, res);
});

export default router;
