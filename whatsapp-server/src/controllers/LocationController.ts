import { Request, Response } from 'express';
import { LocationService } from '../services/LocationService';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

export class LocationController {
    static async validateLocation(req: Request, res: Response) {
        try {
            const { address, lat, lng } = req.body;

            if (!address && (!lat || !lng)) {
                return res.status(400).json({ error: 'Dirección o coordenadas requeridas' });
            }

            // 1. Get zones and store config
            const [{ data: zones }, { data: config }] = await Promise.all([
                supabase.from('shipping_zones').select('*').eq('is_active', true),
                supabase.from('whatsapp_config').select('store_lat, store_lng').limit(1).maybeSingle()
            ]);

            if (!zones || zones.length === 0) {
                return res.json({ allowed: true, message: 'No hay zonas de envío configuradas (acceso libre)' });
            }

            const storeLoc = (config?.store_lat && config?.store_lng) 
                ? { lat: config.store_lat, lng: config.store_lng } 
                : undefined;
            
            const clientLoc = (lat && lng) ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined;

            // 2. Validate
            const result = await LocationService.determineShippingZone(zones, clientLoc, storeLoc, address);

            logger.info(`[PublicAPI] Location validation for "${address || 'GPS'}": ${result.allowed ? 'ALLOWED' : 'BLOCKED'}`);

            return res.json({
                allowed: result.allowed,
                error: result.error,
                zone: result.zone ? {
                    id: result.zone.id,
                    name: result.zone.name,
                    cost: result.zone.cost
                } : null,
                distance_km: result.distance_km
            });

        } catch (error: any) {
            logger.error('[PublicAPI] Error validating location:', error);
            return res.status(500).json({ error: 'Error interno al validar ubicación' });
        }
    }
}
