import { describe, it, expect } from 'vitest';
import { LocationService, ShippingZone } from '../LocationService';

// isPointInPolygon expects GeoJSON ({ type, coordinates }) where each
// coordinate is [lng, lat]. The ring covers lat -38.71..-38.69, lng -62.27..-62.25.
const barrio = {
    id: 'b1',
    name: 'VILLA MITRE',
    zone_type: 'polygon',
    is_active: true,
    allow_delivery: true,
    max_radius_km: null,
    cost: 800,
    polygon: {
        type: 'Polygon',
        coordinates: [[
            [-62.27, -38.71],
            [-62.25, -38.71],
            [-62.25, -38.69],
            [-62.27, -38.69],
            [-62.27, -38.71],
        ]],
    },
} as unknown as ShippingZone;

const tier = {
    id: 't1',
    name: 'Nueva Zona (Distancia)',
    zone_type: 'radius',
    is_active: true,
    allow_delivery: true,
    max_radius_km: 3,
    polygon: null,
    cost: 1000,
} as unknown as ShippingZone;

describe('LocationService.determineShippingZone barrio', () => {
    it('returns the polygon barrio name alongside the radius pricing zone', async () => {
        const client = { lat: -38.70, lng: -62.26 };
        const store = { lat: -38.70, lng: -62.26 };
        const res = await LocationService.determineShippingZone([barrio, tier], client, store, null);
        expect(res.allowed).toBe(true);
        expect(res.zone?.zone_type).toBe('radius');
        expect((res as any).barrio).toBe('VILLA MITRE');
    });
});
