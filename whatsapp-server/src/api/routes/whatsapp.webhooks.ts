import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../../utils/logger';
import conversationRouter from '../../core/engine/conversation.router';
import { officialWhatsAppClient } from '../../infrastructure/whatsapp/OfficialWhatsAppClient';

const router = Router();

// In-memory deduplication (stores message IDs for 10 minutes)
const processedMessageIds = new Set<string>();
const DEDUPLICATION_TIMEOUT = 10 * 60 * 1000; 

/**
 * Middleware to verify X-Hub-Signature-256
 */
const verifySignature = (req: Request, res: Response, next: Function) => {
    const signature = req.headers['x-hub-signature-256'] as string;
    const appSecret = (process.env.WHATSAPP_APP_SECRET || '').trim();

    // Support bypass for debugging or if secret is missing
    if (!appSecret || process.env.BYPASS_SIGNATURE === 'true') {
        if (process.env.BYPASS_SIGNATURE === 'true' && signature) {
            // Only log once per request if needed, but for now just proceed
        }
        return next();
    }

    if (!signature) {
        logger.warn('[Webhook] Missing X-Hub-Signature-256 header.');
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
        logger.warn(`[Webhook] Invalid Signature.\n  - Received: ${signatureHash}\n  - Expected: ${expectedHash}`);
        return res.sendStatus(401);
    }

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

    // ACK Meta immediately to stop any retry timers
    res.sendStatus(200);

    if (body.object === 'whatsapp_business_account') {
        // Background processing
        (async () => {
            try {
                for (const entry of body.entry) {
                    for (const change of entry.changes) {
                        if (change.field !== 'messages') continue;

                        const value = change.value;
                        
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
                        }

                        if (text) {
                            logger.info(`[OfficialWA] Processing: ${phone} -> "${text}" (id: ${messageId})`);
                            const responses = await conversationRouter.processMessage(phone, text, pushName, context);
                            // Send all generated responses in parallel to minimize latency
                            await Promise.all(responses.map(async (response) => {
                                try {
                                    await officialWhatsAppClient.sendMessage(phone, response);
                                } catch (err: any) {
                                    logger.error(`[OfficialWA] Failed to send specific response: ${err.message}`);
                                }
                            }));
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
