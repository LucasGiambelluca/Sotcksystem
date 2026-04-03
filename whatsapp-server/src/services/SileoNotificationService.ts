import axios from 'axios';
import { ConfigurationService } from './ConfigurationService';

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
        let apiKey = process.env.SILEO_API_KEY || '';
        
        try {
             // Look up centralized config for dynamic sileo key
             const appConfig = await ConfigurationService.getFullConfig();
             if (appConfig.sileo_api_key) {
                 apiKey = appConfig.sileo_api_key;
             }
        } catch (dbErr) {
             console.warn('⚠️ Could not fetch Sileo API key from ConfigurationService, using fallback.', dbErr);
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
