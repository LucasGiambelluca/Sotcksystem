import { Request, Response } from 'express';
import { OptimizationService } from '../../core/logistics/optimization/OptimizationService';
import { MapsUrlService } from '../../core/logistics/routing/MapsUrlService';
import { RouteNotificationService } from '../../core/logistics/notifications/RouteNotificationService';
import { supabase } from '../../config/database'; // Adjust path if needed

export class LogisticsController {
    private optimizationService: OptimizationService;
    private mapsService: MapsUrlService;

    private notificationService: RouteNotificationService;

    constructor() {
        this.optimizationService = new OptimizationService();
        this.mapsService = new MapsUrlService();
        this.notificationService = new RouteNotificationService();
    }

    /**
     * POST /api/logistics/routes/:id/optimize
     */
    optimizeRoute = async (req: Request, res: Response) => {
        const { id } = req.params;
        const { strategy } = req.body || {};
        try {
            const result = await this.optimizationService.optimizeRoute(id, strategy || 'nearest_first');
            
            res.json({
                success: true,
                data: result.optimizedOrders,
                metrics: result.metrics,
                summary: {
                    stops: result.stops,
                    distance: result.total_distance,
                    strategy: result.strategy
                }
            });
        } catch (error: any) {
            console.error('[LogisticsController] Optimize Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * POST /api/logistics/routes/:id/sequence
     * Manual Drag & Drop reorder
     */
    updateSequence = async (req: Request, res: Response) => {
        const { id } = req.params;
        const { new_sequence } = req.body; // Array of { route_order_id, sequence_number }

        if (!Array.isArray(new_sequence)) {
             return res.status(400).json({ error: 'Invalid sequence format' });
        }

        try {
            // Prepare an array for a single bulk upsert query.
            // Supabase/PostgreSQL upsert requires the primary key ('id') to update existing rows.
            const updates = new_sequence.map(item => ({
                id: item.route_order_id,
                route_id: id,
                sequence_number: item.sequence_number
            }));

            // Perform a single network request to update all sequence numbers
            const { error } = await supabase
                .from('route_orders')
                .upsert(updates, { onConflict: 'id' });

            if (error) throw error;
            
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * GET /api/logistics/routes/:id/navigation-url
     * Generates Google Maps URL
     */
    getNavigationUrl = async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            // Fetch route with orders and client info
            const { data: route, error } = await supabase
                .from('routes')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !route) throw new Error('Route not found');

            const { data: orders } = await supabase
                .from('route_orders')
                .select('*, order:orders(id, delivery_address, client:clients(address))')
                .eq('route_id', id)
                .order('sequence_number', { ascending: true });

            if (!orders || orders.length === 0) {
                 return res.json({ url: '', message: 'No orders in route' });
            }

            // Helper to get best address
            const getAddress = (o: any) => {
                return o.formatted_address || o.order?.delivery_address || o.order?.client?.address || '';
            };

            // Filter out stops with NO address at all
            const validOrders = orders.filter((o: any) => getAddress(o) !== '');

            if (validOrders.length === 0) {
                return res.json({ url: '', message: 'No valid addresses in route' });
            }

            // Build props
            const origin = route.start_address || 'Current Location'; 
            const destination = getAddress(validOrders[validOrders.length - 1]);
            const waypoints = validOrders.slice(0, -1).map((o: any) => ({
                address: getAddress(o)
            }));

            // Use MapsService
            const navResult = this.mapsService.generateNavigationUrl(origin, waypoints, destination);
            res.json(navResult);

        } catch (error: any) {
            console.error('[LogisticsController] Navigation URL Error:', error);
             res.status(500).json({ error: error.message });
        }
    }

    /**
     * POST /api/logistics/routes/:id/share
     * Share route via WhatsApp
     */
    shareRoute = async (req: Request, res: Response) => {
        const { id } = req.params;
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'Driver phone number is required' });
        }

        try {
            const result = await this.notificationService.sendRouteToDriver(id, phone);
            res.json(result);

        } catch (error: any) {
            console.error('[LogisticsController] Share Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * GET /api/driver/routes/:id
     * Public endpoint for driver view
     */
    getDriverRoute = async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const { data: route, error } = await supabase
                .from('routes')
                .select('id, name, status, start_address, total_distance_km, estimated_duration_min')
                .eq('id', id)
                .single();

            if (error || !route) return res.status(404).json({ error: 'Ruta no encontrada' });

            const { data: orders } = await supabase
                .from('route_orders')
                .select(`
                    id, 
                    sequence_number, 
                    estimated_arrival, 
                    status,
                    formatted_address,
                    delivery_lat,
                    delivery_lng,
                    order:orders (
                        id, 
                        client:clients (name, phone)
                    )
                `)
                .eq('route_id', id)
                .order('sequence_number', { ascending: true });

            res.json({
                route,
                orders: orders || []
            });

        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * POST /api/driver/orders/:id/status
     * Update status (DELIVERED, FAILED)
     */
    updateOrderDeliveryStatus = async (req: Request, res: Response) => {
        const { id } = req.params; // route_order_id
        const { status, reason } = req.body;

        try {
            const { error } = await supabase
                .from('route_orders')
                .update({ 
                    status, 
                    notes: reason ? `Motivo: ${reason}` : null,
                    completed_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            
            // If delivered, update main order status too?
            // Ideally yes, but keeping it simple for MVP. 
            // The route_order status is enough for the dashboard.

            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
