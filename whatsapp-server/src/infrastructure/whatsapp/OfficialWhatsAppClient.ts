import axios from 'axios';
import { PhoneUtils } from '../../utils/phoneUtils';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import { encryptionService } from '../../services/EncryptionService';

interface MetaCredentials {
    accessToken: string;
    phoneNumberId: string;
    wabaId: string;
    appSecret: string;
    verifyToken: string;
}

export class OfficialWhatsAppClient {
    private credentials: MetaCredentials | null = null;
    private lastCredentialFetch: number = 0;
    private readonly CREDENTIAL_CACHE_TTL = 60000; // 60 seconds
    private apiVersion: string = 'v21.0';

    /**
     * Lazy-loads credentials from DB first, falls back to .env.
     * Caches for 60 seconds to avoid hitting DB on every message.
     */
    private async loadCredentials(): Promise<MetaCredentials> {
        const now = Date.now();
        if (this.credentials && (now - this.lastCredentialFetch < this.CREDENTIAL_CACHE_TTL)) {
            return this.credentials;
        }

        try {
            // 1. Try loading from DB (whatsapp_config table)
            const { data: configs } = await supabase
                .from('whatsapp_config')
                .select(`
                    meta_cloud_token, 
                    meta_token_encrypted, 
                    meta_phone_number_id, 
                    meta_waba_id,
                    meta_app_secret, 
                    meta_verify_token
                `)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1);

            const dbConfig = configs && configs.length > 0 ? configs[0] : null;

            if (dbConfig) {
                let token = dbConfig.meta_cloud_token;
                
                // Prioritize encrypted token if available
                if (dbConfig.meta_token_encrypted) {
                    try {
                        token = encryptionService.decrypt(dbConfig.meta_token_encrypted);
                    } catch (err: any) {
                        logger.error(`[OfficialWA] Failed to decrypt token: ${err.message}`);
                    }
                }

                if (token && dbConfig.meta_phone_number_id) {
                    this.credentials = {
                        accessToken: token,
                        phoneNumberId: dbConfig.meta_phone_number_id,
                        wabaId: dbConfig.meta_waba_id || '',
                        appSecret: dbConfig.meta_app_secret || '',
                        verifyToken: dbConfig.meta_verify_token || 'SotckSystemToken2026',
                    };
                    this.lastCredentialFetch = now;
                    return this.credentials;
                }
            }
        } catch (err: any) {
            logger.warn(`[OfficialWA] DB credential fetch failed, falling back to .env: ${err.message}`);
        }

        // 2. Fallback to .env
        this.credentials = {
            accessToken: process.env.WHATSAPP_CLOUD_TOKEN || '',
            phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
            wabaId: process.env.WHATSAPP_WABA_ID || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
            appSecret: process.env.WHATSAPP_APP_SECRET || '',
            verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'SotckSystemToken2026',
        };
        logger.info(`[OfficialWA] Loaded credentials from .env. Token valid: ${!!this.credentials.accessToken}, PhoneID: ${this.credentials.phoneNumberId}`);
        this.lastCredentialFetch = now;
        return this.credentials;
    }

    /**
     * Force reload credentials (e.g., after saving new ones from the panel).
     */
    public clearCredentialCache(): void {
        this.credentials = null;
        this.lastCredentialFetch = 0;
    }

    private getBaseUrl(phoneNumberId: string) {
        return `https://graph.facebook.com/${this.apiVersion}/${phoneNumberId}`;
    }

    private getHeaders(accessToken: string) {
        return {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };
    }

    async sendMessage(to: string, message: any): Promise<any> {
        const creds = await this.loadCredentials();
        if (!creds.accessToken || !creds.phoneNumberId) {
            logger.error('[OfficialWA] Cannot send message: Missing credentials', { token: !!creds.accessToken, phoneId: !!creds.phoneNumberId });
            return;
        }

        const cleanTo = PhoneUtils.normalize(to);
        
        // Normalize Argentine numbers for Meta API: 54 + 9 + area + number -> 54 + area + number
        let apiTo = cleanTo;
        if (apiTo.startsWith('549') && apiTo.length === 13) {
            apiTo = '54' + apiTo.substring(3);
        }

        try {
            let payload: any = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: apiTo
            };

            if (typeof message === 'string') {
                payload.type = 'text';
                payload.text = { body: message };
            } else if (message.interactive) {
                payload.type = 'interactive';
                
                // Sanitizar títulos de botones porque Meta Cloud API rechaza Markdown en los títulos
                const sanitizedInteractive = JSON.parse(JSON.stringify(message.interactive));
                const removeMd = (s: string) => s ? s.replace(/[*_~`]/g, '').trim() : '';
                
                if (sanitizedInteractive.action?.buttons) {
                    sanitizedInteractive.action.buttons.forEach((b: any) => {
                        if (b.reply?.title) b.reply.title = removeMd(b.reply.title).substring(0, 20);
                    });
                }
                if (sanitizedInteractive.action?.sections) {
                    sanitizedInteractive.action.sections.forEach((s: any) => {
                        if (s.title) s.title = removeMd(s.title).substring(0, 24);
                        if (s.rows) {
                            s.rows.forEach((r: any) => {
                                if (r.title) r.title = removeMd(r.title).substring(0, 24);
                                if (r.description) r.description = removeMd(r.description).substring(0, 72);
                            });
                        }
                    });
                }
                payload.interactive = sanitizedInteractive;
            } else if (message.text) {
                payload.type = 'text';
                payload.text = { body: message.text };
            } else if (message.image) {
                payload.type = 'image';
                const link = typeof message.image === 'string' ? message.image : message.image.url;
                payload.image = { link: link, caption: message.caption };
            } else if (message.document) {
                payload.type = 'document';
                const link = typeof message.document === 'string' ? message.document : message.document.url;
                payload.document = { 
                    link: link, 
                    filename: message.fileName || 'document.pdf',
                    caption: message.caption 
                };
            } else if (message.poll) {
                payload.type = 'interactive';
                const removeMd = (s: string) => s ? s.replace(/[*_~`]/g, '').trim() : '';
                payload.interactive = {
                    type: 'button',
                    body: { text: message.poll.name },
                    action: {
                        buttons: message.poll.options.slice(0, 3).map((opt: any, idx: number) => ({
                            type: 'reply',
                            reply: { id: `poll_${idx}`, title: removeMd(opt.optionName).substring(0, 20) }
                        }))
                    }
                };
            } else if (message.message) {
                payload.type = 'text';
                payload.text = { body: message.message };
            }

            const baseUrl = this.getBaseUrl(creds.phoneNumberId);
            const headers = this.getHeaders(creds.accessToken);

            logger.info(`[OfficialWA] Sending message to ${to}`, { type: payload.type, url: `${baseUrl}/messages` });
            
            // Use native fetch with a timeout instead of axios for better stability on some systems
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

            const response = await fetch(`${baseUrl}/messages`, {
                method: 'POST',
                headers: headers as any,
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Meta API error (${response.status}): ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            logger.info(`[OfficialWA] Message sent successfully to ${to}. ID: ${data.messages[0].id}`);
            
            // Save to DB
            const content = payload.text?.body || payload.interactive?.body?.text || '[Media/Poll]';
            this.saveOutboundMessageDB(cleanTo, content, payload.type, data.messages[0].id)
                .catch(err => logger.error(`[OfficialWA] Error saving outbound message to DB: ${err.message}`));

            return data;
        } catch (error: any) {
            logger.error(`[OfficialWA] Error sending message to ${to}`, { 
                error: error.message,
                name: error.name
            });
            throw error;
        }
    }

    async downloadMedia(mediaId: string): Promise<Buffer> {
        const creds = await this.loadCredentials();
        if (!creds.accessToken) throw new Error('Official WA Access Token not configured');

        try {
            logger.debug(`[OfficialWA] Fetching media info for ID: ${mediaId}`);
            const metaUrlResponse = await axios.get(`https://graph.facebook.com/${this.apiVersion}/${mediaId}`, {
                headers: { 'Authorization': `Bearer ${creds.accessToken}` }
            });

            const mediaUrl = metaUrlResponse.data?.url;
            if (!mediaUrl) throw new Error('Could not retrieve media URL from Meta response');

            logger.debug(`[OfficialWA] Downloading media content from Meta URL`);
            const mediaResponse = await axios.get(mediaUrl, {
                headers: { 'Authorization': `Bearer ${creds.accessToken}` },
                responseType: 'arraybuffer'
            });

            return Buffer.from(mediaResponse.data);
        } catch (error: any) {
            const errorData = error.response?.data || error.message;
            logger.error(`[OfficialWA] Error downloading media ${mediaId}`, { error: errorData });
            throw new Error(`Media download failed: ${error.message}`);
        }
    }

    private async saveOutboundMessageDB(phone: string, text: string, type: string, wa_id: string) {
        try {
            let { data: convo } = await supabase.from('whatsapp_conversations').select('id').eq('phone', phone).maybeSingle();
            
            if (!convo) {
                const { data: newConvo } = await supabase.from('whatsapp_conversations')
                    .insert({ phone, contact_name: phone, unread_count: 0 })
                    .select('id').single();
                convo = newConvo;
            }

            if (convo) {
                await supabase.from('whatsapp_messages').insert({
                    conversation_id: convo.id,
                    direction: 'OUTBOUND',
                    content: text,
                    message_type: type.toUpperCase(),
                    wa_message_id: wa_id,
                    is_read: true
                });
                await supabase.from('whatsapp_conversations').update({
                    last_message: text,
                    last_message_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }).eq('id', convo.id);
            }
        } catch (e) {
            logger.error('Failed to save official outbound message to DB:', e);
        }
    }

    public async saveInboundMessageDB(phone: string, contactName: string, text: string, type: string = 'TEXT', wa_message_id: string = '') {
        try {
            let { data: convo } = await supabase.from('whatsapp_conversations').select('id, unread_count').eq('phone', phone).maybeSingle();
            
            if (!convo) {
                const { data: newConvo } = await supabase.from('whatsapp_conversations')
                    .insert({ phone, contact_name: contactName || phone, unread_count: 1 })
                    .select('id, unread_count').single();
                convo = newConvo;
            } else {
                await supabase.from('whatsapp_conversations').update({
                    unread_count: (convo.unread_count || 0) + 1,
                    last_message: text,
                    last_message_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }).eq('id', convo.id);
            }

            if (convo) {
                await supabase.from('whatsapp_messages').insert({
                    conversation_id: convo.id,
                    direction: 'INBOUND',
                    content: text,
                    message_type: type.toUpperCase(),
                    wa_message_id,
                    is_read: false
                });
            }
        } catch (e) {
            logger.error('Failed to save official inbound message to DB:', e);
        }
    }

    /**
     * Test if the current credentials are valid by calling the Meta Graph API
     */
    async testCredentials(token?: string, phoneId?: string): Promise<{ valid: boolean; phone?: string; error?: string }> {
        const testToken = token || (await this.loadCredentials()).accessToken;
        const testPhoneId = phoneId || (await this.loadCredentials()).phoneNumberId;

        if (!testToken || !testPhoneId) {
            return { valid: false, error: 'Token o Phone Number ID vacío' };
        }

        try {
            const res = await axios.get(
                `https://graph.facebook.com/${this.apiVersion}/${testPhoneId}?fields=display_phone_number,verified_name`,
                { headers: { 'Authorization': `Bearer ${testToken}` } }
            );
            return {
                valid: true,
                phone: res.data.display_phone_number || testPhoneId,
            };
        } catch (err: any) {
            const msg = err.response?.data?.error?.message || err.message;
            return { valid: false, error: msg };
        }
    }

    /**
     * Checks if the client has valid credentials (from DB or .env).
     * This is an async check now that credentials are lazy-loaded.
     */
    async isConfiguredAsync(): Promise<boolean> {
        const creds = await this.loadCredentials();
        return !!(creds.accessToken && creds.phoneNumberId);
    }

    /**
     * Synchronous check — uses cached credentials only.
     * For backward compatibility with places that call isConfigured() synchronously.
     */
    isConfigured(): boolean {
        if (this.credentials) {
            return !!(this.credentials.accessToken && this.credentials.phoneNumberId);
        }
        // Fallback to .env for initial startup before first async load
        return !!(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
    }
}

export const officialWhatsAppClient = new OfficialWhatsAppClient();
