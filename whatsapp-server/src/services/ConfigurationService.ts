
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

export interface AppConfig {
    // Branding
    business_name: string;
    logo_url: string;
    accent_color: string;
    
    // Store Location
    store_lat: number | null;
    store_lng: number | null;
    store_address: string | null;
    store_city: string;
    
    // Business Logic
    shipping_policy: string;
    auto_print: boolean;
    checkout_message: string;
    sileo_api_key?: string | null;
    
    // Metadata
    whatsapp_phone?: string | null;
}

export class ConfigurationService {
    private static cache: AppConfig | null = null;
    private static lastFetch: number = 0;
    private static CACHE_TTL = 30000; // 30 seconds

    /**
     * Obtiene la configuración completa del sistema (Branding + Config).
     * Siempre prioriza los registros más recientes y activos.
     */
    public static async getFullConfig(forceRefresh = false): Promise<AppConfig> {
        const now = Date.now();
        if (!forceRefresh && this.cache && (now - this.lastFetch < this.CACHE_TTL)) {
            return this.cache;
        }

        try {
            // 1. Obtener WhatsApp Config (El último activo)
            const { data: wConfigs, error: wError } = await supabase
                .from('whatsapp_config')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1);

            if (wError) throw wError;
            const wConfig = wConfigs && wConfigs.length > 0 ? wConfigs[0] : null;

            // 2. Obtener Public Branding (El último)
            const { data: bConfigs, error: bError } = await supabase
                .from('public_branding')
                .select('*')
                .limit(1);

            if (bError) throw bError;
            const bConfig = bConfigs && bConfigs.length > 0 ? bConfigs[0] : null;

            // 3. Mergear datos con fallbacks seguros
            const mergedConfig: AppConfig = {
                business_name: bConfig?.catalog_business_name || wConfig?.catalog_business_name || 'Mi Negocio',
                logo_url: bConfig?.catalog_logo_url || wConfig?.catalog_logo_url || '',
                accent_color: bConfig?.catalog_accent_color || wConfig?.catalog_accent_color || '#dc2626',
                
                store_lat: wConfig?.store_lat || null,
                store_lng: wConfig?.store_lng || null,
                store_address: wConfig?.store_address || null,
                store_city: wConfig?.store_city || 'Bahía Blanca',
                
                shipping_policy: wConfig?.shipping_policy || 'smart',
                auto_print: wConfig?.auto_print || false,
                checkout_message: wConfig?.checkout_message || '¡Gracias por tu pedido!',
                sileo_api_key: wConfig?.sileo_api_key || null,
                whatsapp_phone: bConfig?.whatsapp_phone || wConfig?.whatsapp_phone || null
            };

            this.cache = mergedConfig;
            this.lastFetch = now;
            return mergedConfig;

        } catch (error: any) {
            logger.error(`[ConfigurationService] Error loading config: ${error.message}`);
            // Fallback mínimo si falla la DB
            return {
                business_name: 'Negocio',
                logo_url: '',
                accent_color: '#dc2626',
                store_lat: null,
                store_lng: null,
                store_address: null,
                store_city: 'Bahía Blanca',
                shipping_policy: 'smart',
                auto_print: false,
                checkout_message: 'Gracias por tu pedido'
            };
        }
    }

    /**
     * Limpia el cache de configuración.
     */
    public static clearCache(): void {
        this.cache = null;
        this.lastFetch = 0;
    }
}
