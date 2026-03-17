import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../../utils/logger';
import conversationRouter from '../../core/engine/conversation.router';
import { officialWhatsAppClient } from '../../infrastructure/whatsapp/OfficialWhatsAppClient';

const router = Router();

/**
 * Middleware to verify X-Hub-Signature-256
 * Required for production to ensure requests come from Meta.
 */
const verifySignature = (req: Request, res: Response, next: Function) => {
    const signature = req.headers['x-hub-signature-256'] as string;
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    if (!appSecret) {
        // Skip validation if secret is not set (e.g., local development without secret)
        return next();
    }

    if (!signature) {
        logger.warn('[Webhook] Missing X-Hub-Signature-256 header.');
        return res.sendStatus(401);
    }

    const elements = signature.split('=');
    const signatureHash = elements[1];
    const expectedHash = crypto
        .createHmac('sha256', appSecret)
        .update((req as any).rawBody || JSON.stringify(req.body))
        .digest('hex');

    if (signatureHash !== expectedHash) {
        logger.warn('[Webhook] Invalid X-Hub-Signature-256.');
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
        logger.info('[Webhook] Webhook verified successfully.');
        res.status(200).send(challenge);
    } else {
        logger.warn(`[Webhook] Verification failed. Mode: ${mode}, Received Token: ${token}, Expected: ${verifyToken}`);
        res.sendStatus(403);
    }
});

// 2. Message Event Handling (POST)
router.post('/webhook', verifySignature, async (req: Request, res: Response) => {
    const body = req.body;

    // Check if it's a WhatsApp event
    if (body.object === 'whatsapp_business_account') {
        try {
            for (const entry of body.entry) {
                for (const change of entry.changes) {
                    if (change.field !== 'messages') continue;

                    const value = change.value;
                    const metadata = value.metadata;
                    if (metadata) {
                        logger.info(`[Webhook] Incoming from Phone Number ID: ${metadata.phone_number_id}`);
                    }
                    const contact = value.contacts?.[0];
                    const message = value.messages?.[0];

                    if (!message) continue;

                    const phone = message.from; // Phone number in 549... format
                    const pushName = contact?.profile?.name || 'Usuario';
                    const messageId = message.id;

                    let text = '';
                    let context: any = { messageId };

                    // Map Cloud API message types to internal format
                    if (message.type === 'text') {
                        text = message.text.body;
                    } else if (message.type === 'button') {
                        text = message.button.text;
                    } else if (message.type === 'interactive') {
                        if (message.interactive.type === 'button_reply') {
                            text = message.interactive.button_reply.title;
                        } else if (message.interactive.type === 'list_reply') {
                            text = message.interactive.list_reply.title;
                        }
                    } else if (message.type === 'location') {
                        text = '_LOCATION_RECEIVED_';
                        context._location = {
                            lat: message.location.latitude,
                            lng: message.location.longitude
                        };
                    } else if (message.type === 'image') {
                        text = message.image.caption || '_MEDIA_RECEIVED_';
                        context._receivedFile = { 
                            url: message.image.id, // In Cloud API, we use the ID to download later if needed, or link
                            mimeType: message.image.mime_type,
                            isOfficialId: true 
                        };
                    }

                    if (text) {
                        logger.info(`[OfficialWA] Incoming message from ${phone}: ${text}`);
                        
                        // Process through Router
                        // Note: Internal Router expects response array
                        const responses = await conversationRouter.processMessage(phone, text, pushName, context);
                        
                        for (const response of responses) {
                            await officialWhatsAppClient.sendMessage(phone, response);
                        }
                    }
                }
            }
            res.sendStatus(200);
        } catch (err: any) {
            logger.error('[Webhook] Error processing message:', { 
                message: err.message, 
                stack: err.stack,
                data: err.response?.data 
            });
            res.sendStatus(500);
        }
    } else {
        res.sendStatus(404);
    }
});

export default router;
