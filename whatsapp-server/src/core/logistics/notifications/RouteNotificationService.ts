
import axios from 'axios';
import { supabase } from '../../../config/database';
import { MapsUrlService } from '../routing/MapsUrlService';

export class RouteNotificationService {
    private mapsService: MapsUrlService;
    private readonly API_URL = 'http://localhost:3001/api/send-message'; // Internal call

    constructor() {
        this.mapsService = new MapsUrlService();
    }

    /**
     * Send route details and navigation link to a driver via WhatsApp
     */
    async sendRouteToDriver(routeId: string, driverPhone: string) {
        try {
            // 1. Fetch Route Details
            const { data: route, error } = await supabase
                .from('routes')
                .select('*')
                .eq('id', routeId)
                .single();

            if (error || !route) throw new Error('Route not found');

            // 2. Fetch Orders
            const { data: orders } = await supabase
                .from('route_orders')
                .select('*, order:orders(id, delivery_address, client:clients(address))')
                .eq('route_id', routeId)
                .order('sequence_number', { ascending: true });
                
            if (!orders || orders.length === 0) throw new Error('No orders in route');

            // 3. Generate Navigation URL
             // Helper to get best address
            const getAddress = (o: any) => {
                return o.formatted_address || o.order?.delivery_address || o.order?.client?.address || '';
            };

            const validOrders = orders.filter((o: any) => getAddress(o) !== '');
            
            if (validOrders.length === 0) throw new Error('No valid addresses to navigate');

            const origin = route.start_address || 'Deposito Central';
            const destination = getAddress(validOrders[validOrders.length - 1]);
            const waypoints = validOrders.slice(0, -1).map((o: any) => ({
                address: getAddress(o)
            }));

            const navResult = this.mapsService.generateNavigationUrl(origin, waypoints, destination);
            const navigationUrl = navResult.primary_url;

            // 4. Construct Message
            const message = `🚚 *Nueva Ruta Asignada: ${route.name}*\n\n` +
                            `📍 *Paradas:* ${orders.length}\n` +
                            `📏 *Distancia:* ${route.total_distance_km || '?'} km\n` +
                            `⏱️ *Tiempo Est:* ${Math.round(route.estimated_duration_min / 60)}h ${route.estimated_duration_min % 60}m\n\n` +
                            `🔗 *Enlace de Navegación:*\n${navigationUrl}\n\n` +
                            `📲 *Panel de Chofer (Entregas):*\n${process.env.FRONTEND_URL || 'http://localhost:5173'}/driver/${routeId}\n\n` +
                            `¡Buen viaje! 👋`;

            // 5. Send via Internal API
            // Ensure phone has country code. Assuming AR +549... or similar.
            // If already formatted, just send.
            console.log(`[Notification] Sending route to ${driverPhone}`);
            
            await axios.post(this.API_URL, {
                phone: driverPhone,
                message: message
            });

            // 6. Update Route Status/Log (Optional)
            await supabase.from('routes').update({ 
                notifications_sent: true,
                status: 'ACTIVE' // Activating route on send? Maybe not explicit here.
            }).eq('id', routeId);

            return { success: true, message: 'Route sent to driver' };

        } catch (error: any) {
            console.error('[RouteNotificationService] Error:', error.message);
            throw new Error(`Failed to send route: ${error.message}`);
        }
    }
}
