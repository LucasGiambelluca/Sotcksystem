import axios from 'axios';

export interface SileoNotificationOptions {
    title: string;
    message: string;
    priority?: 'high' | 'normal' | 'low';
    metadata?: any;
}

export class SileoNotificationService {
    // Sileo API url based on typical integration or from env
    private apiUrl: string;
    
    constructor() {
        this.apiUrl = process.env.SILEO_API_URL || 'https://api.sileo.com/v1/notify';
    }

    /**
     * Sends a push notification or alert to the admins/staff via Sileo
     */
    async sendNotification(options: SileoNotificationOptions): Promise<boolean> {
        // Fetch API key dynamically from DB to support in-app changes
        const { supabase } = require('../config/database');
        
        let apiKey = process.env.SILEO_API_KEY || '';
        
        try {
             // Look up whatsapp config for dynamic sileo key
             const { data: config } = await supabase.from('whatsapp_config').select('sileo_api_key').single();
             if (config && config.sileo_api_key) {
                 apiKey = config.sileo_api_key;
             }
        } catch (dbErr) {
             console.warn('⚠️ Could not fetch Sileo API key from DB, using fallback.', dbErr);
        }

        if (!apiKey) {
            console.warn('⚠️ Sileo API Key not configured. Skipping notification:', options.title);
            return false;
        }

        try {
            const payload = {
                title: options.title,
                body: options.message,
                level: options.priority || 'normal',
                data: options.metadata || {}
            };

            await axios.post(this.apiUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000 // fail fast if sileo is down
            });
            
            console.log(`✅ Sileo notification sent: ${options.title}`);
            return true;
        } catch (error: any) {
            console.error('❌ Failed to send Sileo notification:', error.message);
            return false; // Don't crash the bot if notifications fail
        }
    }
}

export const sileoService = new SileoNotificationService();
