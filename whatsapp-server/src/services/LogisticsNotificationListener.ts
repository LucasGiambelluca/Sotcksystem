import { supabase } from '../config/database';
import { whatsappClient } from '../infrastructure/whatsapp/WhatsAppClient';

export class LogisticsNotificationListener {
  private static instance: LogisticsNotificationListener;
  private channel: any = null;
  private processedArrivals = new Set<string>(); // Cache to prevent duplicate notifications

  private constructor() {}

  public static getInstance(): LogisticsNotificationListener {
    if (!LogisticsNotificationListener.instance) {
      LogisticsNotificationListener.instance = new LogisticsNotificationListener();
    }
    return LogisticsNotificationListener.instance;
  }

  public start() {
    console.log('📡 [LogisticsNotificationListener] Starting Realtime listener for courier arrivals...');
    
    const channelName = `courier-arrival-notifications-${Date.now()}`;
    console.log(`📡 [LogisticsNotificationListener] Intentando conectar al canal: ${channelName}`);

    this.channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assignment_orders',
        },
        async (payload) => {
          const newStatus = payload.new?.status;
          const stopId = payload.new?.id;

          if (newStatus === 'ARRIVED' && !this.processedArrivals.has(stopId)) {
            const actionType = payload.new?.action_type;
            
            // Only notify for DELIVERIES
            if (actionType === 'DELIVERY') {
                this.processedArrivals.add(stopId);
                
                // Cleanup after 30 minutes to keep memory usage low
                setTimeout(() => this.processedArrivals.delete(stopId), 1800000);

                console.log(`🔔 [LogisticsNotificationListener] Triggering handleArrival for Stop: ${stopId} | Order: ${payload.new?.order_id}`);
                await this.handleArrival(payload.new?.order_id);
            } else {
                console.log(`ℹ️ [LogisticsNotificationListener] Skipping (not DELIVERY): ${stopId}`);
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`📡 [LogisticsNotificationListener] Successfully subscribed for courier arrivals.`);
        } else {
          console.error(`📡 [LogisticsNotificationListener] Subscription status: ${status}`, err || '');
        }
      });
  }

  private async handleArrival(orderId: string) {
    if (!orderId) return;

    try {
      // Fetch order details with client info
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, client:clients(*)')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        console.error('❌ [LogisticsNotificationListener] Error fetching order details:', orderError);
        return;
      }

      const phone = order.phone || order.client?.phone;
      if (!phone) {
        console.log(`⚠️ [LogisticsNotificationListener] No phone for order ${orderId}, skipping.`);
        return;
      }

      const clientName = order.client?.name || 'Cliente';
      const orderNum = order.id.slice(0, 8);

      const message = `🏠 *¡Hola ${clientName}!* Tu repartidor ya está en la puerta con tu pedido #${orderNum}. ¡Pronto saldrá a recibirte!`;

      console.log(`📤 [LogisticsNotificationListener] Sending arrival notification to ${phone}...`);
      await whatsappClient.sendMessage(phone, { text: message });
      console.log(`✅ [LogisticsNotificationListener] Arrival notification sent for order ${orderId}`);

    } catch (err) {
      console.error('❌ [LogisticsNotificationListener] Fatal error:', err);
    }
  }

  public stop() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}

export const logisticsNotificationListener = LogisticsNotificationListener.getInstance();
