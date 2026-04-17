import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../../utils/logger';
import conversationRouter from '../../core/engine/conversation.router';
import { officialWhatsAppClient } from '../../infrastructure/whatsapp/OfficialWhatsAppClient';

const router = Router({ mergeParams: true });

// In-memory deduplication (stores message IDs for 10 minutes)
const processedMessageIds = new Set<string>();
const DEDUPLICATION_TIMEOUT = 10 * 60 * 1000; 

/**
 * Middleware to verify X-Hub-Signature-256
 */
    // Support bypass for debugging or if secret is missing
    if (!appSecret || process.env.BYPASS_SIGNATURE === 'true') {
        console.log(`[Webhook] Signature bypass active. appSecret: ${!!appSecret}, BYPASS: ${process.env.BYPASS_SIGNATURE}`);
        return next();
    }

    if (!signature) {
        console.log('[Webhook] Missing X-Hub-Signature-256 header.');
        return res.sendStatus(401);
    }

    const elements = signature.split('=');
    const signatureHash = elements[1];
    const rawBody = (req as any).rawBody;
    const payload = rawBody || Buffer.from(JSON.stringify(req.body));

    const expectedHash = crypto
        .createHmac('sha256', appSecret)
        .update(payload)
        .digest('hex');

    if (signatureHash !== expectedHash) {
        console.log(`[Webhook] Invalid Signature.\n  - Received: ${signatureHash}\n  - Expected: ${expectedHash}`);
        return res.sendStatus(401);
    }

    console.log('[Webhook] Signature verified OK.');
    next();
};

// 1. Webhook Verification (GET)
router.get('/webhook', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'SotckSystemToken2026';

    if (mode === 'subscribe' && token === verifyToken) {
        logger.info('[Webhook] verified successfully.');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// 2. Message Event Handling (POST)
router.post('/webhook', verifySignature, async (req: Request, res: Response) => {
    const body = req.body;
    
    console.log('\n----------------------------------------');
    console.log('📩 [WEBHOOK-INCOMING] Mensaje recibido de Meta!');
    console.log(`   - Path: ${req.originalUrl}`);
    console.log(`   - Body: ${JSON.stringify(body).substring(0, 400)}`);
    console.log('----------------------------------------\n');

    // ACK Meta immediately
    res.sendStatus(200);

    if (body.object === 'whatsapp_business_account') {
        // Background processing
        (async () => {
            try {
                for (const entry of body.entry) {
                    for (const change of entry.changes) {
                        if (change.field !== 'messages') continue;

                        const value = change.value;
                        const metadata = value.metadata;
                        const phoneIdInConfig = process.env.WHATSAPP_PHONE_NUMBER_ID;
                        const urlBotId = req.params.botId;

                        // MULTI-BOT FILTER: Ensure this instance only handles messages for its own number
                        
                        // 1. Check URL identifier if present (Isolation via URL)
                        if (urlBotId && phoneIdInConfig && urlBotId !== phoneIdInConfig) {
                            // This request is physically directed to the wrong bot endpoint (according to URL)
                            return; // Stop processing entirely for this request
                        }

                        // 2. Check Payload Metadata (Isolation via Content)
                        if (metadata && metadata.phone_number_id) {
                            if (phoneIdInConfig && metadata.phone_number_id !== phoneIdInConfig) {
                                logger.info(`[Webhook] 🔕 IGNORED: Message for Phone ID ${metadata.phone_number_id} (Instance: ${phoneIdInConfig})`);
                                continue;
                            }
                        } else {
                            if (phoneIdInConfig && !value.statuses && !value.messages) {
                                 // Not a message event, continue
                            }
                        }
                        
                        // Ignore status updates (delivered, read, sent)
                        if (value.statuses) continue;

                        const message = value.messages?.[0];
                        if (!message) continue;

                        const messageId = message.id;
                        const timestamp = parseInt(message.timestamp);
                        const now = Math.floor(Date.now() / 1000);

                        // A. STALE MESSAGE FILTER (Ignore old retries > 2 mins)
                        if (now - timestamp > 120) {
                            logger.info(`[Webhook] Ignoring stale retry (id: ${messageId}, age: ${now - timestamp}s)`);
                            continue;
                        }

                        // B. DEDUPLICATION (Ignore if ID already handled)
                        if (processedMessageIds.has(messageId)) {
                            logger.info(`[Webhook] Duplicate ignored (id: ${messageId})`);
                            continue;
                        }

                        // Mark as processed
                        processedMessageIds.add(messageId);
                        setTimeout(() => processedMessageIds.delete(messageId), DEDUPLICATION_TIMEOUT);

                        const phone = message.from;
                        const pushName = value.contacts?.[0]?.profile?.name || 'Usuario';
                        let text = '';
                        let context: any = { messageId };

                        // Map message type
                        if (message.type === 'text') {
                            text = message.text.body;
                        } else if (message.type === 'button') {
                            text = message.button.text;
                        } else if (message.type === 'interactive') {
                            text = message.interactive.button_reply?.title || message.interactive.list_reply?.title || '';
                        } else if (message.type === 'location') {
                            text = '_LOCATION_RECEIVED_';
                            context._location = { lat: message.location.latitude, lng: message.location.longitude };
                        } else if (message.type === 'image') {
                            text = message.image.caption || '_MEDIA_RECEIVED_';
                            context._receivedFile = { url: message.image.id, mimeType: message.image.mime_type, isOfficialId: true };
                        } else if (message.type === 'audio') {
                            logger.info(`[OfficialWA] Processing audio note from ${phone}...`);
                            try {
                                const audioBuffer = await officialWhatsAppClient.downloadMedia(message.audio.id);
                                const { AIService } = require('../../services/AIService');
                                const transcription = await AIService.transcribe(audioBuffer, 'voice.ogg');
                                
                                if (transcription) {
                                    text = transcription;
                                    logger.info(`[OfficialWA] Audio transcribed: "${text}"`);
                                    context._isAudio = true;
                                } else {
                                    text = '_AUDIO_RECEIVED_';
                                }
                            } catch (audioErr: any) {
                                logger.error(`[OfficialWA] Failed to process audio: ${audioErr.message}`);
                                text = '_AUDIO_ERROR_';
                            }
                        }

                        if (text) {
                            logger.info(`[OfficialWA] Processing: ${phone} -> "${text}" (id: ${messageId})`);
                            const responses = await conversationRouter.processMessage(phone, text, pushName, context);
                            // Send responses sequentially to preserve message order
                            for (const response of responses) {
                                try {
                                    await officialWhatsAppClient.sendMessage(phone, response);
                                } catch (err: any) {
                                    logger.error(`[OfficialWA] Failed to send response: ${err.message}`);
                                }
                            }
                        }
                    }
                }
            } catch (err: any) {
                logger.error('[Webhook] Internal loop error:', err.message);
            }
        })();
    }
});

export default router;
