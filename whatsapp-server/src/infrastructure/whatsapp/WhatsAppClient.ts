import 'dotenv/config';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode';
import { supabase } from '../../config/database';
import fs from 'fs';
import path from 'path';
import Router from '../../core/router';
import { default as storageService } from '../../services/storageService';

const AUTH_DIR = process.env.BAILEYS_SESSION_PATH || path.join(__dirname, '../../../auth_info_baileys');
const MAX_RECONNECT_ATTEMPTS = 10;

export type WhatsAppStatus = 'STOPPED' | 'WORKING' | 'SCAN_QR_CODE';

class WhatsAppClient {
    private sock: any = null;
    private qrCodeData: string | null = null;
    private status: WhatsAppStatus = 'STOPPED';
    private reconnectAttempts = 0;

    public getSock() {
        return this.sock;
    }

    public getStatus() {
        return this.status;
    }

    public getQrCode() {
        return this.qrCodeData;
    }

    public async start() {
        if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
        console.log(`📁 Auth dir: ${AUTH_DIR}`);
        
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        const { version } = await fetchLatestBaileysVersion();
        
        console.log(`Starting WhatsApp Bot v${version.join('.')}`);

        this.sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }) as any,
            browser: Browsers.macOS('Desktop'),
            syncFullHistory: false
        });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('connection.update', async (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                this.qrCodeData = await qrcode.toDataURL(qr);
                this.status = 'SCAN_QR_CODE';
                console.log('📱 QR Code generated. Scan it below:');
                qrcode.toString(qr, { type: 'terminal', small: true }, (err, url) => {
                    if (err) console.error(err);
                    else console.log(url);
                });
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'unknown error';
                console.log(`⚠️ Connection closed. Code: ${statusCode}, Error: ${errorMessage}`);
                
                this.status = 'STOPPED';

                // Handle specific disconnect reasons
                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    console.error('❌ Logged out from WhatsApp. Session is invalid.');
                    this.clearSession(); // Remove corrupt/invalid session
                    console.log('🔄 Restarting to request new QR code...');
                    this.start(); // Auto-restart to generate new QR
                } else if (statusCode === DisconnectReason.restartRequired) {
                    console.log('🔄 Restart required. Reconnecting immediately...');
                    this.start();
                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    console.error('❌ Connection replaced (opened in another tab/device). Stopping.');
                    // Do not auto-reconnect if replaced, unless explicitly commanded
                } else if (statusCode === DisconnectReason.badSession) {
                    console.error('❌ Bad session file. Deleting session and requesting new scan.');
                    this.clearSession();
                    this.start();
                } else if (statusCode === DisconnectReason.connectionClosed || statusCode === DisconnectReason.connectionLost || statusCode === DisconnectReason.timedOut) {
                    this.reconnectAttempts++;
                    console.log(`⚠️ Connection lost/timed out. Attempt: ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
                    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        // Exponential backoff: 3s, 6s, 12s, 24s... Max 30s
                        const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1500, 30000);
                        console.log(`⏳ Reconnecting in ${delay/1000}s...`);
                        setTimeout(() => this.start(), delay);
                    } else {
                        console.error('🚨 Max reconnection attempts reached. Manual intervention required.');
                    }
                } else {
                    // Unknown reason, attempt normal reconnect with backoff
                    this.reconnectAttempts++;
                    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        setTimeout(() => this.start(), 5000);
                    }
                }
            } else if (connection === 'open') {
                console.log('✅ Connected to WhatsApp!');
                this.status = 'WORKING';
                this.qrCodeData = null;
                this.reconnectAttempts = 0; // Reset on successful connection
            }
        });

        // Event: Poll Updates
        this.sock.ev.on('messages.update', async (updates: any) => {
            for (const update of updates) {
                 if (!update.update?.pollUpdates) continue;
                 const pollUpdates = update.update.pollUpdates;
                 console.log(`📊 [PollHandler] Received ${pollUpdates.length} poll update(s)`);

                 for (const pollUpdate of pollUpdates) {
                     const vote = pollUpdate.vote || pollUpdate;
                     const selectedOptions = vote?.selectedOptions || vote?.options || [];
                     
                     if (selectedOptions.length === 0) continue;

                     const remoteJid = update.key?.remoteJid;
                     if (!remoteJid) continue;
                     
                     const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '');

                     const rawOption = selectedOptions[0];
                     let voteHash = '';
                     
                     if (Buffer.isBuffer(rawOption) || rawOption instanceof Uint8Array) {
                         voteHash = Buffer.from(rawOption).toString('hex').toUpperCase();
                     } else if (typeof rawOption === 'string') {
                         voteHash = rawOption.toUpperCase();
                     } else {
                         continue;
                     }

                     console.log(`📊 [PollHandler] Vote from ${phone}: hash=${voteHash.substring(0, 16)}...`);

                     try {
                         // Delete poll message
                         try {
                             await this.sock?.sendMessage(remoteJid, { delete: update.key });
                         } catch (delErr: any) {
                             console.warn('📊 [PollHandler] Could not delete poll:', delErr.message);
                         }

                         // Process vote through Router
                         const responses = await Router.handlePollUpdate(phone, voteHash);
                         
                         for (const response of (responses || [])) {
                             await this.sendFormattedMessage(remoteJid, response);
                         }
                     } catch (err) {
                         console.error('📊 [PollHandler] Error:', err);
                     }
                 }
            }
        });

        // Event: Message Upsert
        this.sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
            if (type !== 'notify') return;

            for (const msg of messages) {
                if (!msg.message) continue;
                if (msg.key.fromMe) continue;
                if (msg.key.remoteJid === 'status@broadcast') continue;

                const remoteJid = msg.key.remoteJid || '';
                let phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '');
                const pushName = msg.pushName || 'Usuario';
                
                let text = '';
                let fileContext = null;
                
                if (msg.message.conversation) text = msg.message.conversation;
                else if (msg.message.extendedTextMessage) text = msg.message.extendedTextMessage.text;
                
                if (msg.message.imageMessage || msg.message.documentMessage) {
                    console.log(`[Media] Receiving media from ${phone}...`);
                    try {
                        const buffer = await downloadMediaMessage(msg, 'buffer', { });
                        const mimeType = msg.message.imageMessage ? msg.message.imageMessage.mimetype : msg.message.documentMessage.mimetype;
                        const publicUrl = await storageService.uploadMedia(phone, buffer as Buffer, mimeType);
                        
                        if (publicUrl) {
                            fileContext = { _receivedFile: { url: publicUrl, mimeType: mimeType, size: (buffer as Buffer).length } };
                            text = msg.message.imageMessage?.caption || msg.message.documentMessage?.caption || '_MEDIA_RECEIVED_'; 
                        }
                    } catch (err) {
                        console.error('[Media] Error processing media:', err);
                    }
                }

                if (!text && !fileContext) continue;
     
                console.log(`📩 Message from ${pushName} (${phone}): ${text}`);

                try {
                    // Save inbound message
                    await this.saveInboundMessageDB(phone, pushName, text, fileContext ? 'image' : 'text', msg.key?.id);

                    const responses = await Router.processMessage(phone, text, pushName, fileContext || {});
                    for (const response of responses) {
                        await this.sendFormattedMessage(remoteJid, response);
                    }
                } catch (err) {
                    console.error('Processing Error:', err);
                }
            }
        });
    }

    private async sendFormattedMessage(jid: string, response: any) {
        if (!this.sock) return;

        // Ensure JID is formatted correctly for Baileys
        const finalJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;

        try {
            let sentMsg: any = null;
            let textToSave = '';
            let msgType: 'text'|'poll'|'image'|'document' = 'text'; // Added 'document' type

            if (typeof response === 'string') {
                sentMsg = await this.sock.sendMessage(finalJid, { text: response });
                textToSave = response;
            } else if (typeof response === 'object' && response !== null) {
                if (response.poll) {
                    sentMsg = await this.sock.sendMessage(finalJid, { poll: response.poll });
                    textToSave = `[Encuesta: ${response.poll.name}]`;
                    msgType = 'poll';
                } else if (response.text) {
                    sentMsg = await this.sock.sendMessage(finalJid, { text: response.text });
                    textToSave = response.text;
                } else if (response.document) {
                    sentMsg = await this.sock.sendMessage(finalJid, { 
                        document: response.document, 
                        mimetype: response.mimetype || 'application/pdf', 
                        fileName: response.fileName || 'document.pdf',
                        caption: response.caption 
                    });
                    textToSave = `[Documento: ${response.fileName || 'archivo'}]`;
                    msgType = 'document'; // Set type for document
                } else if (response.image) {
                    sentMsg = await this.sock.sendMessage(finalJid, { 
                        image: response.image, 
                        caption: response.caption 
                    });
                    textToSave = response.caption || '[Imagen]';
                    msgType = 'image';
                } else if (response.message) {
                    sentMsg = await this.sock.sendMessage(finalJid, { text: response.message });
                    textToSave = response.message;
                }
            }

            if (sentMsg && textToSave) {
                await this.saveOutboundMessageDB(finalJid, textToSave, msgType, sentMsg.key?.id);
            }
        } catch (error) {
            console.error(`Error sending message to ${jid}:`, error);
        }
    }

    private async saveOutboundMessageDB(phone: string, text: string, type: 'text' | 'image' | 'poll' | 'document' = 'text', wa_id: string = '') {
        try {
            let cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
            cleanPhone = cleanPhone.replace('@c.us', '').replace('@s.whatsapp.net', '').replace('@lid', '');
            
            let { data: convo } = await supabase.from('whatsapp_conversations').select('id').eq('phone', cleanPhone).maybeSingle();
            
            if (!convo) {
                const { data: newConvo } = await supabase.from('whatsapp_conversations')
                    .insert({ phone: cleanPhone, contact_name: cleanPhone, unread_count: 0 })
                    .select('id').single();
                convo = newConvo;
            }

            if (convo) {
                await supabase.from('whatsapp_messages').insert({
                    conversation_id: convo.id,
                    direction: 'OUTBOUND',
                    content: text,
                    message_type: type,
                    wa_message_id: wa_id,
                    is_read: true // Outbound by bot is intrinsically read
                });
                await supabase.from('whatsapp_conversations').update({
                    last_message: text,
                    last_message_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }).eq('id', convo.id);
            }
        } catch (e) {
            console.error('Failed to save outbound message to DB:', e);
        }
    }

    private async saveInboundMessageDB(phone: string, contactName: string, text: string, type: 'text' | 'image' | 'poll' | 'document' = 'text', wa_id: string = '') {
        try {
            let cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
            cleanPhone = cleanPhone.replace('@c.us', '').replace('@s.whatsapp.net', '').replace('@lid', '');
            
            let { data: convo } = await supabase.from('whatsapp_conversations').select('id, unread_count').eq('phone', cleanPhone).maybeSingle();
            
            if (!convo) {
                const { data: newConvo } = await supabase.from('whatsapp_conversations')
                    .insert({ phone: cleanPhone, contact_name: contactName || cleanPhone, unread_count: 1 })
                    .select('id, unread_count').single();
                convo = newConvo;
            }

            if (convo) {
                // Check if message already exists
                const { data: existingMsg } = await supabase.from('whatsapp_messages').select('id').eq('wa_message_id', wa_id).maybeSingle();
                
                if (!existingMsg) {
                    await supabase.from('whatsapp_messages').insert({
                        conversation_id: convo.id,
                        direction: 'INBOUND',
                        content: text,
                        message_type: type,
                        wa_message_id: wa_id,
                        is_read: false
                    });
                    await supabase.from('whatsapp_conversations').update({
                        last_message: text,
                        last_message_at: new Date().toISOString(),
                        unread_count: (convo.unread_count || 0) + 1,
                        updated_at: new Date().toISOString()
                    }).eq('id', convo.id);
                }
            }
        } catch (e) {
            console.error('Failed to save inbound message to DB:', e);
        }
    }
    private clearSession() {
        console.log(`🗑️ Clearing corrupt or logged-out session at ${AUTH_DIR}`);
        try {
            if (fs.existsSync(AUTH_DIR)) {
                fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            }
        } catch (err) {
            console.error('❌ Failed to clear session directory:', err);
        }
        this.status = 'STOPPED';
        this.sock = null;
        this.qrCodeData = null;
    }

    public async logout() {
        console.log('🚪 Manual logout triggered. Closing connection and clearing session.');
        this.status = 'STOPPED';
        if (this.sock) {
            this.sock.ev.removeAllListeners();
            this.sock.end(undefined);
            this.sock = null;
        }
        this.clearSession();
        return { success: true, message: 'Bot logged out successfully' };
    }
}

// Export a singleton instance
export const whatsappClient = new WhatsAppClient();
export default whatsappClient;
