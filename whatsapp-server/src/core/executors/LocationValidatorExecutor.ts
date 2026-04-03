import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';
import { LocationService } from '../../services/LocationService';
import { GeocodingService } from '../../services/GeocodingService';
import { ConfigurationService } from '../../services/ConfigurationService';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

export class LocationValidatorExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        // 1. Extraer entrada (GPS o Texto)
        // El motor inyecta automáticamente _lat y _lng si el mensaje es de tipo ubicación
        const latKey = Object.keys(context).find(k => k.endsWith('_lat'));
        const lngKey = Object.keys(context).find(k => k.endsWith('_lng'));
        
        let clientLoc = (latKey && lngKey && context[latKey] && context[lngKey]) 
            ? { lat: parseFloat(context[latKey]), lng: parseFloat(context[lngKey]) }
            : null;

        // Smart address extraction (supporting AI extracted objects and common names)
        let addressText = context.direccion_cliente || context.direccion || context.respuesta;
        
        // Handle nested objects from AI (Deep lookup)
        if (!addressText && context.pedido_temp) {
            const temp = typeof context.pedido_temp === 'string' ? JSON.parse(context.pedido_temp) : context.pedido_temp;
            addressText = temp.direccion || temp.address;
        }

        // 1. Obtener Configuración Centralizada
        const appConfig = await ConfigurationService.getFullConfig();

        // 2. Si no hay GPS pero hay texto, geocodificar con contexto regional
        if (!clientLoc && addressText && typeof addressText === 'string' && addressText.trim().length > 3) {
            try {
                const cityContext = appConfig.store_city || 'Bahia Blanca';
                
                const geo = await GeocodingService.geocode(addressText, cityContext);
                if (geo) {
                    clientLoc = { lat: geo.lat, lng: geo.lng };
                    // Actualizar contexto con la dirección formal de Google para mejor precisión
                    context.direccion_cliente_normalizada = geo.address;
                    context.direccion_lat = geo.lat;
                    context.direccion_lng = geo.lng;
                    logger.info(`[LocationValidator] Geocoded "${addressText}" using context "${cityContext}" to ${geo.lat}, ${geo.lng}`);
                }
            } catch (e: any) {
                logger.error(`[LocationValidator] Geocoding failed: ${e.message}`);
            }
        }

        if (!clientLoc) {
            return {
                messages: [],
                wait_for_input: false,
                conditionResult: data.failHandle || 'FUERA DE ZONA'
            };
        }

        // 3. Obtener Zonas desde la DB (La config ya la tenemos)
        const { data: zones } = await supabase.from('shipping_zones').select('*').eq('is_active', true);

        const storeLoc = (appConfig.store_lat && appConfig.store_lng) 
            ? { lat: appConfig.store_lat, lng: appConfig.store_lng } 
            : undefined;

        if (!storeLoc) {
            logger.warn('[LocationValidator] Store location not configured, skipping radius checks but allowing polygon checks.');
        }

        // 4. Validar contra Zonas (LocationService se encarga de la lógica de polígonos/radios)
        const validation = await LocationService.determineShippingZone(zones || [], clientLoc, storeLoc);

        logger.info(`[LocationValidator] [TRACE] Loc: ${clientLoc.lat}, ${clientLoc.lng} | Allowed: ${validation.allowed} | Zone: ${validation.zone?.name || 'NONE'}`);

        if (!validation.allowed) {
            logger.warn(`[LocationValidator] BLOCKING delivery to: "${addressText}" | Error: ${validation.error}`);
            return {
                messages: [validation.error || "Lo sentimos, no llegamos a esa ubicación."],
                wait_for_input: false,
                conditionResult: data.failHandle || 'false',
                nextNodeId: data.failNodeId 
            };
        }

        // 5. Todo OK
        return {
            messages: [],
            wait_for_input: false,
            conditionResult: data.successHandle || 'true',
            updatedContext: {
                shipping_zone_id: validation.zone?.id,
                shipping_cost: validation.zone?.cost || 0,
                distance_km: validation.distance_km,
                location_validated: true
            }
        };
    }
}
