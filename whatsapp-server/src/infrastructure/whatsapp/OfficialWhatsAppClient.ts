import axios from 'axios';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

export class OfficialWhatsAppClient {
    private accessToken: string;
    private phoneNumberId: string;
    private apiVersion: string = 'v22.0';

    constructor() {
        this.accessToken = process.env.WHATSAPP_CLOUD_TOKEN || '';
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    }

    private get baseUrl() {
        return `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
    }

    private get headers() {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
        };
    }

    async sendMessage(to: string, message: any): Promise<any> {
        const cleanTo = to.replace(/[^0-9]/g, '');
        
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
                payload.interactive = {
                    type: 'button',
                    body: { text: message.poll.name },
                    action: {
                        buttons: message.poll.options.slice(0, 3).map((opt: any, idx: number) => ({
                            type: 'reply',
                            reply: { id: `poll_${idx}`, title: opt.optionName.substring(0, 20) }
                        }))
                    }
                };
            } else if (message.message) {
                payload.type = 'text';
                payload.text = { body: message.message };
            }

            logger.info(`[OfficialWA] Sending message to ${to}`, { type: payload.type, url: `${this.baseUrl}/messages` });
            const response = await axios.post(`${this.baseUrl}/messages`, payload, { headers: this.headers });
            logger.info(`[OfficialWA] Message sent successfully to ${to}. ID: ${response.data.messages[0].id}`);
            
            // Save to DB
            const content = payload.text?.body || payload.image?.caption || payload.document?.caption || '[Media/Poll]';
            // Save to DB asynchronously to avoid blocking the response
            this.saveOutboundMessageDB(cleanTo, content, payload.type, response.data.messages[0].id)
                .catch(err => logger.error(`[OfficialWA] Error saving outbound message to DB: ${err.message}`));

            return response.data;
        } catch (error: any) {
            logger.error(`[OfficialWA] Error sending message to ${to}`, { 
                error: error.response?.data || error.message,
                payload: message 
            });
            throw error;
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
    isConfigured(): boolean {
        return !!(this.accessToken && this.phoneNumberId);
    }
}

export const officialWhatsAppClient = new OfficialWhatsAppClient();
