import cron from 'node-cron';
import axios from 'axios';
import { supabase } from '../config/database';
import { encryptionService } from './EncryptionService';
import { logger } from '../utils/logger';

class TokenRefreshJob {
    /**
     * Runs every day at 3 AM.
     */
    start() {
        cron.schedule('0 3 * * *', () => {
            this.refreshExpiringTokens();
        });
        logger.info('[TokenRefreshJob] Scheduled Meta token refresh job (3 AM daily)');
    }

    async refreshExpiringTokens() {
        logger.info('[TokenRefreshJob] Checking for expiring Meta tokens...');

        try {
            // Find tokens expiring in the next 7 days
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

            const { data: configs, error } = await supabase
                .from('whatsapp_config')
                .select('id, meta_token_encrypted, meta_token_expires_at')
                .not('meta_token_encrypted', 'is', null)
                .lt('meta_token_expires_at', sevenDaysFromNow.toISOString());

            if (error) throw error;
            if (!configs || configs.length === 0) {
                logger.info('[TokenRefreshJob] No tokens need refreshing.');
                return;
            }

            const appId = process.env.META_APP_ID;
            const appSecret = process.env.META_APP_SECRET;

            if (!appId || !appSecret) {
                logger.error('[TokenRefreshJob] Missing META_APP_ID or META_APP_SECRET in env.');
                return;
            }

            for (const config of configs) {
                try {
                    logger.info(`[TokenRefreshJob] Refreshing token for config ID: ${config.id}`);
                    
                    const currentToken = encryptionService.decrypt(config.meta_token_encrypted);

                    // Exchange existing long-lived token for a new one
                    const response = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
                        params: {
                            grant_type: 'fb_exchange_token',
                            client_id: appId,
                            client_secret: appSecret,
                            fb_exchange_token: currentToken
                        }
                    });

                    const newToken = response.data.access_token;
                    const expiresIn = response.data.expires_in;

                    const encryptedNewToken = encryptionService.encrypt(newToken);
                    const newExpiresAt = new Date();
                    newExpiresAt.setSeconds(newExpiresAt.getSeconds() + (expiresIn || 5184000));

                    await supabase
                        .from('whatsapp_config')
                        .update({
                            meta_token_encrypted: encryptedNewToken,
                            meta_token_expires_at: newExpiresAt.toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', config.id);

                    logger.info(`✅ [TokenRefreshJob] Successfully refreshed token for config ${config.id}`);

                } catch (tokenErr: any) {
                    logger.error(`❌ [TokenRefreshJob] Failed to refresh token ${config.id}: ${tokenErr.message}`);
                    
                    // If refresh fails, we should notify the user or mark the config as needing attention
                    // For now, we just log it. In a real scenario, we might want to flag the status.
                }
            }

        } catch (err: any) {
            logger.error(`[TokenRefreshJob] Job error: ${err.message}`);
        }
    }
}

export const tokenRefreshJob = new TokenRefreshJob();
