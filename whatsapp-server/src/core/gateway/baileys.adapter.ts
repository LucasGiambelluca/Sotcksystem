import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    WASocket,
    ConnectionState,
    BaileysEventMap,
    fetchLatestBaileysVersion,
    delay
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import { Mutex } from 'async-mutex';

import * as QRCode from 'qrcode';
import { IWhatsAppGateway, IWhatsAppMessage } from './whatsapp.interface';

// Anti-ban configuration
const MIN_TYPING_DELAY = 1000;
const MAX_TYPING_DELAY = 3000;
const MIN_SEND_DELAY = 2000;
const MAX_SEND_DELAY = 5000;
const BOT_LOOP_THRESHOLD = 5; // Max messages to the same user
const BOT_LOOP_WINDOW_MS = 10000; // in a 10-second window

interface MessageHistory {
    count: number;
    firstMessageAt: number;
}

export class BaileysAdapter implements IWhatsAppGateway {
    private sock: WASocket | null = null;
    private authState: any;
    private saveCreds: any;
    private readonly authDir: string;
    private readonly logger: any;
    
    // Anti-ban state
    private sendMutex = new Mutex();
    private userSendHistory: Map<string, MessageHistory> = new Map();

    constructor(authDir: string = './auth_info_baileys') {
        this.authDir = authDir;
        this.logger = pino({ level: 'debug' });
    }

    async initialize(externalEventHandler?: (update: Partial<ConnectionState>) => void) {
        const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
        this.authState = state;
        this.saveCreds = saveCreds;

        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`Using WhatsApp version v${version.join('.')}, isLatest: ${isLatest}`);

        this.sock = makeWASocket({
            version,
            printQRInTerminal: false, // Handle manually
            auth: this.authState,
            logger: this.logger,
            browser: ['Sotcksystem', 'Chrome', '1.0.0'],
            emitOwnEvents: true // Allow processing of self-messages for testing
        });

        this.sock.ev.on('connection.update', (update) => {
            this.handleConnectionUpdate(update);
            if (externalEventHandler) {
                externalEventHandler(update);
            }
        });





        this.sock.ev.on('messages.upsert', (event) => {
            console.log('Baileys Internal Upsert:', JSON.stringify(event, null, 2));
        });

        this.sock.ev.on('messages.update', (event) => {
            console.log('Baileys Internal Message Update:', JSON.stringify(event, null, 2));
        });

        this.sock.ev.on('messaging-history.set', (event) => {
            console.log('Baileys History Set:', JSON.stringify(event, null, 2));
        });

        this.sock.ev.on('creds.update', this.saveCreds);
        
        return this.sock.ev;
    }

    private async handleConnectionUpdate(update: Partial<ConnectionState>) {
        console.log('Baileys Internal Update:', JSON.stringify(update, null, 2));
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            this.logger.info('QR Code received. Scan it to connect.');
            try {
                const qrString = await QRCode.toString(qr, { type: 'terminal', small: true });
                console.log(qrString);
            } catch (err) {
                console.error('Failed to generate QR code:', err);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            this.logger.error(`Connection closed due to ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`);
            
            // Auto-reconnect or Generate new QR (re-initialize)
            // Even if logged out, we want to start fresh to show QR
            if (shouldReconnect) {
                await this.initialize();
            } else {
                this.logger.error('Connection closed. You are logged out. Re-initializing to generate new QR...');
                // Optional: Clean up auth folder if needed, but Baileys usually handles logout
                await this.initialize(); 
            }
        } else if (connection === 'open') {
            this.logger.info('Opened connection');
        }
    }

    private async simulateTyping(to: string, textLength: number) {
        if (!this.sock) return;
        try {
            // First we need to send regular presence to ensure the other side knows we're online
            await this.sock.presenceSubscribe(to);
            await delay(500);

            // Emit the writing status
            await this.sock.sendPresenceUpdate('composing', to);
            
            // 50ms per character, capped between MIN and MAX delays
            const calcDelay = Math.min(Math.max(textLength * 50, MIN_TYPING_DELAY), MAX_TYPING_DELAY);
            await delay(calcDelay);
            
            // Revert the writing status back to paused
            await this.sock.sendPresenceUpdate('paused', to);
            // Pequeña pausa adicional antes de despachar el mensaje real
            await delay(200); 
        } catch (error) {
            this.logger.error('Failed to simulate typing:', error);
        }
    }

    async sendMessage(to: string, content: IWhatsAppMessage): Promise<void> {
        if (!this.sock) {
            console.error('Socket not initialized');
            return;
        }

        const jid = to.includes('@s.whatsapp.net') || to.includes('@g.us') 
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
                this.logger.warn(`[Anti-Ban] Bot loop detected for ${jid}. Dropping outbound message.`);
                return; // Drop message to break loop
            }
        }
        this.userSendHistory.set(jid, history);

        // Enqueue sending to prevent rapid bursts
        await this.sendMutex.runExclusive(async () => {
            try {
                if (content.text) {
                    await this.simulateTyping(jid, content.text.length);
                }

                await this.sock!.sendMessage(jid, content as any);
                this.logger.info(`[Anti-Ban] Message sent to ${jid}`);

                // Pause before processing the next message in queue
                const sendDelayMs = Math.floor(Math.random() * (MAX_SEND_DELAY - MIN_SEND_DELAY + 1) + MIN_SEND_DELAY);
                await delay(sendDelayMs);
            } catch (error) {
                console.error(`Failed to send message to ${jid}:`, error);
            }
        });
    }

    async logout() {
        if (!this.sock) return;
        try {
            await this.sock.logout();
            console.log('Logged out successfully');
        } catch (err) {
            console.error('Logout failed:', err);
        }
    }

    async clearAuth() {
        try {
            this.sock?.end(undefined); // Close socket if open
            this.sock = null;
            if (fs.existsSync(this.authDir)) {
                fs.rmSync(this.authDir, { recursive: true, force: true });
                console.log('Auth directory cleared');
            }
        } catch (error) {
            console.error('Failed to clear auth:', error);
        }
    }

    getSocket() {
        return this.sock;
    }
}
