import { Router } from 'express';
import deliverySlotService from '../../services/DeliverySlotService';
import { whatsappClient } from '../../infrastructure/whatsapp/WhatsAppClient';
import { GeocodingService } from '../../services/GeocodingService';


const router = Router();

router.post('/slots/generate', async (req, res) => {
    try {
        await deliverySlotService.generateSlots(7); // Generate for next 7 days
        res.json({ success: true, message: 'Slots generated successfully' });
    } catch (error) {
        console.error('Error generating slots:', error);
        res.status(500).json({ error: 'Failed to generate slots' });
    }
});

router.post('/geocode', async (req, res) => {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'Address is required' });

    try {
        const result = await GeocodingService.geocode(address);
        res.json(result);
    } catch (error: any) {
        console.error('Geocoding error:', error.message);
        res.status(400).json({ error: error.message });
    }
});


router.get('/health', (_req, res) => {
    const status = whatsappClient.getStatus();
    const checks = {
        database: false,
        redis: false,
        whatsapp: status === 'WORKING',
        timestamp: new Date().toISOString()
    };
    
    const statusCode = checks.whatsapp ? 200 : 503;

    res.status(statusCode).json({
        status: checks.whatsapp ? 'healthy' : 'degraded',
        checks,
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

export default router;
