import 'dotenv/config';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode';
import { supabase } from '../../config/database';
import fs from 'fs';
import path from 'path';
import ConversationRouter from '../../core/engine/conversation.router';
import { default as storageService } from '../../services/storageService';
import { Mutex } from 'async-mutex';
import { sessionAuditor } from '../../core/engine/session.auditor';
import { officialWhatsAppClient } from './OfficialWhatsAppClient';

// Anti-ban configuration
const MIN_TYPING_DELAY = 300;
const MAX_TYPING_DELAY = 1000;
const MIN_SEND_DELAY = 500;
const MAX_SEND_DELAY = 1500;
const BOT_LOOP_THRESHOLD = 5;
const BOT_LOOP_WINDOW_MS = 10000;

interface MessageHistory {
    count: number;
    firstMessageAt: number;
}


const AUTH_DIR = process.env.BAILEYS_SESSION_PATH || path.join(__dirname, '../../../auth_info_baileys');
const MAX_RECONNECT_ATTEMPTS = 10;

export type WhatsAppStatus = 'STOPPED' | 'WORKING' | 'SCAN_QR_CODE';

class WhatsAppClient {
    private sock: any = null;
    private qrCodeData: string | null = null;
    private status: WhatsAppStatus = 'STOPPED';
    private reconnectAttempts = 0;
    private sessionClearFailed = false; // Flag to prevent infinite restart loops
    
    // Anti-ban state
    private sendMutex = new Mutex();
    private userSendHistory: Map<string, MessageHistory> = new Map();
    private cleanupInterval: NodeJS.Timeout | null = null;

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
        // Guard: do not restart if session clearing failed (prevents infinite loop)
        if (this.sessionClearFailed) {
            console.error('🚨 [CRITICAL] Cannot start: session directory could not be cleared. Manual intervention required.');
            console.error(`🚨 Please manually delete the folder: ${AUTH_DIR}`);
            return;
        }

        if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
        console.log(`📁 Auth dir: ${AUTH_DIR}`);
        
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        const { version } = await fetchLatestBaileysVersion();
        
        console.log(`Starting WhatsApp Bot v${version.join('.')}`);

        this.sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }) as any,
            browser: ['Mac OS', 'Chrome', '121.0.6167.159'],
            syncFullHistory: false
        });

        // 🟢 Pairing Code Protocol (Alternative to QR Code)
        if (process.env.PAIRING_PHONE_NUMBER && !this.sock.authState.creds.registered) {
            setTimeout(async () => {
                try {
                    const phone = process.env.PAIRING_PHONE_NUMBER?.replace(/[^0-9]/g, '') || '';
                    console.log(`\n⏳ Solicitando Código de Emparejamiento para ${phone}...`);
                    let code = await this.sock.requestPairingCode(phone);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    console.log('\n======================================================');
                    console.log('🔗 CÓDIGO DE VINCULACIÓN DE WHATSAPP: ' + code);
                    console.log('📌 INSTRUCCIONES EN TU CELULAR:');
                    console.log('   1. Abrí WhatsApp > Dispositivos vinculados');
                    console.log('   2. Tocar "Vincular un dispositivo"');
                    console.log('   3. Abajo en la pantalla, tocá "Vincular con el número de teléfono"');
                    console.log('   4. Ingresá el código alfanumérico que ves arriba');
                    console.log('======================================================\n');
                } catch (e: any) {
                    console.error('❌ Error al solicitar código de vinculación:', e.message);
                }
            }, 3000);
        }

        // Fix 1: Periodic cleanup of anti-ban history to prevent memory leaks
        if (!this.cleanupInterval) {
            this.cleanupInterval = setInterval(() => {
                const now = Date.now();
                const TWO_HOURS = 2 * 60 * 60 * 1000;
                let cleaned = 0;
                for (const [jid, history] of this.userSendHistory.entries()) {
                    if (now - history.firstMessageAt > TWO_HOURS) {
                        this.userSendHistory.delete(jid);
                        cleaned++;
                    }
                }
                if (cleaned > 0) {
                    console.log(`🧹 [Anti-Ban Cleanup] Removed ${cleaned} stale entries. Active: ${this.userSendHistory.size}`);
                }
            }, 60 * 60 * 1000); // Run every 1 hour
        }

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('connection.update', async (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                this.qrCodeData = await qrcode.toDataURL(qr);
                this.status = 'SCAN_QR_CODE';
                
                if (!process.env.PAIRING_PHONE_NUMBER) {
                    console.log('📱 QR Code generated. Scan it below:');
                    qrcode.toString(qr, { type: 'terminal', small: true }, (err, url) => {
                        if (err) console.error(err);
                        else console.log(url);
                    });
                }
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
                    
                    if (process.env.PAIRING_PHONE_NUMBER) {
                        console.log('⏳ Esperando 10 segundos antes de solicitar un nuevo código (Para evitar bloqueos de WhatsApp)...');
                        setTimeout(() => this.start(), 10000);
                    } else {
                        console.log('🔄 Restarting to request new QR code...');
                        this.start(); // Auto-restart to generate new QR
                    }
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
                         const responses = await ConversationRouter.handlePollUpdate(phone, voteHash);
                         
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

            const PID = process.pid;
            for (const msg of messages) {
                if (!msg.message) continue;
                if (msg.key.fromMe) continue;
                if (msg.key.remoteJid === 'status@broadcast') continue;

                const remoteJid = msg.key.remoteJid || '';
                let phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '');
                const pushName = msg.pushName || 'Usuario';
                const sessionId = remoteJid.endsWith('@g.us') ? `group:${remoteJid}` : `1to1:${remoteJid}`;
                
                let text = '';
                let fileContext = null;

                // Log entry point (Phase 0)
                sessionAuditor.log({
                    session_id: sessionId,
                    user_phone: phone,
                    event_type: 'message_received',
                    message_id: msg.key.id,
                    details: {
                        pushName,
                        type: msg.message.imageMessage ? 'image' : (msg.message.locationMessage ? 'location' : 'text'),
                        timestamp: msg.messageTimestamp
                    }
                });
                
                if (msg.message.conversation) text = msg.message.conversation;
                else if (msg.message.extendedTextMessage) text = msg.message.extendedTextMessage.text;

                if (msg.message.locationMessage) {
                    console.log(`[Location] Receiving GPS Pin from ${phone}...`);
                    fileContext = { 
                        _location: {
                            lat: msg.message.locationMessage.degreesLatitude,
                            lng: msg.message.locationMessage.degreesLongitude
                        } 
                    };
                    text = '_LOCATION_RECEIVED_';
                }
                
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

                    console.log(`[PID:${PID}] Routing message from ${phone}...`);
                    const responses = await ConversationRouter.processMessage(phone, text, pushName, fileContext || {});
                    console.log(`[PID:${PID}] Got ${responses.length} responses for ${phone}`);
                    
                    for (const response of responses) {
                        await this.sendFormattedMessage(remoteJid, response);
                    }
                } catch (err) {
                    console.error(`[PID:${PID}] Processing Error:`, err);
                }
            }
        });
    }

    public async sendMessage(to: string, message: { text: string }): Promise<void> {
        if (officialWhatsAppClient.isConfigured()) {
            await officialWhatsAppClient.sendMessage(to, message);
            return;
        }

        if (!this.sock) {
            console.error('Socket not initialized');
            return;
        }

        const jid = to.includes('@s.whatsapp.net') || to.includes('@g.us') || to.includes('@status')
            ? to 
            : `${to}@s.whatsapp.net`;

        // Bot loop detection mechanism
        const now = Date.now();
        const history = this.userSendHistory.get(jid) || { count: 0, firstMessageAt: now };
        
        if (now - history.firstMessageAt > BOT_LOOP_WINDOW_MS) {
            history.count = 1;
            history.firstMessageAt = now;
        } else {
            history.count++;
            if (history.count > BOT_LOOP_THRESHOLD) {
                console.warn(`[Anti-Ban] Bot loop detected for ${jid}. Dropping outbound message.`);
                return; // Drop message to break loop
            }
        }
        this.userSendHistory.set(jid, history);

        // Enqueue sending to prevent rapid bursts
        await this.sendMutex.runExclusive(async () => {
            try {
                if (message.text) {
                    await this.simulateTyping(jid, message.text.length);
                }

                const sentMsg = await this.sock.sendMessage(jid, message);
                console.log(`[Anti-Ban] Message sent to ${jid}`);
                
                if (sentMsg && message.text) {
                    await this.saveOutboundMessageDB(jid, message.text, 'text', sentMsg.key?.id);
                }

                // Pause before processing the next message in queue
                const sendDelayMs = Math.floor(Math.random() * (MAX_SEND_DELAY - MIN_SEND_DELAY + 1) + MIN_SEND_DELAY);
                await new Promise(resolve => setTimeout(resolve, sendDelayMs));
            } catch (error) {
                console.error(`Failed to send message to ${jid}:`, error);
            }
        });
    }

    private async simulateTyping(to: string, textLength: number) {
        if (!this.sock) return;
        try {
            await this.sock.presenceSubscribe(to);
            await new Promise(resolve => setTimeout(resolve, 500));
            await this.sock.sendPresenceUpdate('composing', to);
            
            const calcDelay = Math.min(Math.max(textLength * 50, MIN_TYPING_DELAY), MAX_TYPING_DELAY);
            await new Promise(resolve => setTimeout(resolve, calcDelay));
            
            await this.sock.sendPresenceUpdate('paused', to);
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.error('Failed to simulate typing:', error);
        }
    }

    private async sendFormattedMessage(jid: string, response: any) {
        if (officialWhatsAppClient.isConfigured()) {
            await officialWhatsAppClient.sendMessage(jid, response);
            return;
        }

        if (!this.sock) return;

        // Ensure JID is formatted correctly for Baileys
        const finalJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;

        // Bot loop detection
        const now = Date.now();
        const history = this.userSendHistory.get(finalJid) || { count: 0, firstMessageAt: now };
        
        if (now - history.firstMessageAt > BOT_LOOP_WINDOW_MS) {
            history.count = 1;
            history.firstMessageAt = now;
        } else {
            history.count++;
            if (history.count > BOT_LOOP_THRESHOLD) {
                console.warn(`[Anti-Ban] Bot loop detected for ${finalJid}. Dropping outbound message.`);
                return;
            }
        }
        this.userSendHistory.set(finalJid, history);

        await this.sendMutex.runExclusive(async () => {
            try {
                if (!response) {
                    console.warn(`[WhatsAppClient] Dropping empty/undefined message to ${finalJid}`);
                    return;
                }

                let sentMsg: any = null;
                let textToSave = '';
                let msgType: 'text'|'poll'|'image'|'document' = 'text';

                // Typing Indicator
                let textLength = 0;
                if (typeof response === 'string') textLength = response.length;
                else if (response.text) textLength = response.text.length;
                else if (response.message) textLength = response.message.length;
                
                if (textLength > 0) {
                    await this.simulateTyping(finalJid, textLength);
                }

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
                        msgType = 'document';
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

                // Pause before next message (Anti-ban queue logic)
                const sendDelayMs = Math.floor(Math.random() * (MAX_SEND_DELAY - MIN_SEND_DELAY + 1) + MIN_SEND_DELAY);
                await new Promise(resolve => setTimeout(resolve, sendDelayMs));

            } catch (error) {
                console.error(`Error sending message to ${jid}:`, error);
            }
        });
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
    private async clearSession() {
        console.log(`🗑️ Clearing session at ${AUTH_DIR}`);
        
        try {
            if (fs.existsSync(AUTH_DIR)) {
                // Delete using async promises instead of sync, which prevents event loop blocking
                await fs.promises.rm(AUTH_DIR, { recursive: true, force: true });
                console.log('✅ Session directory cleared successfully.');
            }
        } catch (err: any) {
            console.error(`❌ Failed to clear session: ${err.message}`);
            // If it fails (usually due to Windows file locks or similar), we rename it instead
            try {
               const backupDir = `${AUTH_DIR}_backup_${Date.now()}`;
               await fs.promises.rename(AUTH_DIR, backupDir);
               console.log(`✅ Session directory renamed to bypass lock: ${backupDir}`);
            } catch (renameErr: any) {
               console.error(`🚨 [CRITICAL] Could not clear or rename session directory. Manual intervention may be needed: ${renameErr.message}`);
               this.sessionClearFailed = true;
            }
        }

        this.status = 'STOPPED';
        this.sock = null;
        this.qrCodeData = null;
    }

    public async logout() {
        console.log('🚪 Manual logout triggered. Closing connection and clearing session.');
        try {
            this.status = 'STOPPED';
            if (this.sock) {
                // Remove listeners to prevent reconnection loops during logout
                this.sock.ev.removeAllListeners('connection.update');
                this.sock.ws?.close();
                this.sock.end(undefined);
                this.sock = null;
            }
            
            // Wait slightly to ensure socket releases file locks
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.clearSession();
            
            return { success: true, message: 'Bot logged out successfully' };
        } catch (error: any) {
            console.error('Error during logout:', error);
            return { success: false, message: error.message };
        }
    }
}

// Export a singleton instance
export const whatsappClient = new WhatsAppClient();
export default whatsappClient;
