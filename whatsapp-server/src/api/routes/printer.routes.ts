import { Router } from 'express';
import { PrinterService } from '../../services/PrinterService';
import { supabase } from '../../config/database';

const router = Router();

/**
 * Manually enqueue a print job for an order
 */
router.post('/print/:orderId', async (req, res) => {
    const { orderId } = req.params;
    
    try {
        const success = await PrinterService.queueOrderTicket(orderId);
        if (success) {
            res.json({ success: true, message: 'Ticket enqueued successfully' });
        } else {
            res.status(500).json({ error: 'Failed to enqueue ticket' });
        }
    } catch (error: any) {
        console.error('[PrinterRoutes] Manual print error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get thermal printer configuration
 */
router.get('/config', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('whatsapp_config')
            .select('auto_print')
            .maybeSingle();
            
        if (error) throw error;
        res.json(data || { auto_print: false });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update thermal printer configuration
 */
router.patch('/config', async (req, res) => {
    const { auto_print } = req.body;
    
    try {
        const { error } = await supabase
            .from('whatsapp_config')
            .update({ auto_print })
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy check to update existing row
            
        if (error) throw error;
        res.json({ success: true, auto_print });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/test-logo', async (req, res) => {
    try {
        const { data: config } = await supabase.from('printer_config').select('logo_url').limit(1).maybeSingle();
        const url = config?.logo_url || 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co/storage/v1/object/public/system/logos/eldelirio.png';
        
        console.log(`🚨 [PRINTER-LOG] Manual Logo Test Request for URL: ${url}`);
        const result = await PrinterService['processLogo'](url); // Use bracket notation for private static if needed, but here it's accessible
        
        if (result) {
            res.json({ success: true, message: 'Logo processed successfully', length: result.length });
        } else {
            res.status(500).json({ success: false, message: 'Logo processing returned null. Check server logs.' });
        }
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
