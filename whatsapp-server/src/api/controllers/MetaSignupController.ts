import { Request, Response } from 'express';
import axios from 'axios';
import { supabase } from '../../config/database';
import { encryptionService } from '../../services/EncryptionService';
import { officialWhatsAppClient } from '../../infrastructure/whatsapp/OfficialWhatsAppClient';
import { ConfigurationService } from '../../services/ConfigurationService';

class MetaSignupController {
    
    /**
     * Handles the callback from Meta Embedded Signup flow.
     * Receives 'code', 'waba_id', and 'phone_number_id' from the frontend.
     */
    async handleEmbeddedSignup(req: Request, res: Response) {
        const { code, waba_id, phone_number_id } = req.body;

        if (!code || !waba_id || !phone_number_id) {
            return res.status(400).json({ error: 'Missing code, waba_id, or phone_number_id' });
        }

        try {
            const appId = process.env.META_APP_ID;
            const appSecret = process.env.META_APP_SECRET;

            if (!appId || !appSecret) {
                return res.status(500).json({ error: 'Server Meta App credentials not configured' });
            }

            console.log(`[MetaSignup] Initializing signup for WABA: ${waba_id}, Phone: ${phone_number_id}`);

            // 1. Exchange 'code' for User Access Token
            const tokenResponse = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
                params: {
                    client_id: appId,
                    client_secret: appSecret,
                    code: code
                }
            });

            const shortLivedToken = tokenResponse.data.access_token;

            // 2. Exchange for Long-lived Token (60 days)
            const longLivedResponse = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: appId,
                    client_secret: appSecret,
                    fb_exchange_token: shortLivedToken
                }
            });

            const accessToken = longLivedResponse.data.access_token;
            const expiresIn = longLivedResponse.data.expires_in; // seconds

            let finalWabaId = waba_id;
            let finalPhoneId = phone_number_id;

            // 3. Discovery: If WABA or Phone ID are 'auto', fetch them from Meta
            if (finalWabaId === 'auto' || finalPhoneId === 'auto') {
                console.log('[MetaSignup] Discovering WABA and Phone ID...');
                const meResponse = await axios.get('https://graph.facebook.com/v21.0/me/whatsapp_business_accounts', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });

                const wabaList = meResponse.data.data;
                if (!wabaList || wabaList.length === 0) {
                    throw new Error('No WhatsApp Business Accounts found for this user.');
                }

                // Pick the first WABA (usually there's only one in this flow)
                finalWabaId = wabaList[0].id;

                // Now find the phone ID for this WABA
                const phoneListResponse = await axios.get(`https://graph.facebook.com/v21.0/${finalWabaId}/phone_numbers`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });

                const phoneList = phoneListResponse.data.data;
                if (!phoneList || phoneList.length === 0) {
                    throw new Error(`WABA ${finalWabaId} has no registered phone numbers.`);
                }

                finalPhoneId = phoneList[0].id;
                console.log(`[MetaSignup] Discovered WABA: ${finalWabaId}, Phone: ${finalPhoneId}`);
            }

            // 4. Get Phone Number Details (Display number, etc)
            const phoneResponse = await axios.get(`https://graph.facebook.com/v21.0/${finalPhoneId}`, {
                params: { fields: 'display_phone_number,verified_name,quality_rating' },
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            const { display_phone_number, verified_name, quality_rating } = phoneResponse.data;

            // 5. Register Phone Number for Cloud API
            await axios.post(`https://graph.facebook.com/v21.0/${finalPhoneId}/register`, {
                messaging_product: 'whatsapp',
                pin: '123456'
            }, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            // 6. Subscribe WABA to Webhooks
            await axios.post(`https://graph.facebook.com/v21.0/${finalWabaId}/subscribed_apps`, {}, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            // 7. Securely Store Credentials
            const encryptedToken = encryptionService.encrypt(accessToken);
            const expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + (expiresIn || 5184000));

            // Get current active config
            const { data: configs } = await supabase
                .from('whatsapp_config')
                .select('id')
                .eq('is_active', true)
                .limit(1);

            const updateData = {
                meta_waba_id: finalWabaId,
                meta_phone_number_id: finalPhoneId,
                meta_token_encrypted: encryptedToken,
                meta_token_expires_at: expiresAt.toISOString(),
                meta_display_name: verified_name,
                meta_quality_rating: quality_rating,
                connection_method: 'embedded_signup',
                meta_cloud_token: null,
                updated_at: new Date().toISOString()
            };

            if (configs && configs.length > 0) {
                await supabase.from('whatsapp_config')
                    .update(updateData)
                    .eq('id', configs[0].id);
            } else {
                await supabase.from('whatsapp_config')
                    .insert({ ...updateData, is_active: true });
            }

            // 7. Sync with Catalog
            if (display_phone_number) {
                await ConfigurationService.syncBotPhoneNumber(display_phone_number);
            }

            // 8. Clear backend cache to use new credentials
            officialWhatsAppClient.clearCredentialCache();

            console.log(`✅ [MetaSignup] Successfully connected ${display_phone_number} (${verified_name})`);

            res.json({
                success: true,
                phone: display_phone_number,
                display_name: verified_name
            });

        } catch (error: any) {
            const errorMsg = error.response?.data?.error?.message || error.message;
            console.error('❌ [MetaSignup] Error:', errorMsg);
            res.status(500).json({ error: errorMsg });
        }
    }
}

export const metaSignupController = new MetaSignupController();
