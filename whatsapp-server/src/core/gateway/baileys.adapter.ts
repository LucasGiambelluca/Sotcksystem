import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    WASocket,
    ConnectionState,
    BaileysEventMap,
    fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';

import * as QRCode from 'qrcode';

export class BaileysAdapter {
    private sock: WASocket | null = null;
    private authState: any;
    private saveCreds: any;
    private readonly authDir: string;
    private readonly logger: any;

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

    async sendMessage(to: string, content: any) {
        if (!this.sock) {
            console.error('Socket not initialized');
            return;
        }
        try {
            await this.sock.sendMessage(to, content);
            console.log(`Message sent to ${to}`);
        } catch (error) {
            console.error(`Failed to send message to ${to}:`, error);
        }
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
