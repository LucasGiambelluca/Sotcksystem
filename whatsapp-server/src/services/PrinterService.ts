import { supabase } from '../config/database';

/**
 * PrinterService
 * Handles the generation of ESC/POS commands for thermal printers (80mm).
 * Stores formatted tickets in a Supabase queue to be consumed by a local bridge.
 */
export class PrinterService {
    private static COLUMN_WIDTH = 42; // Standard for 80mm (Font A)

    /**
     * Enqueues a printer job for a specific order.
     */
    static async queueOrderTicket(orderId: string): Promise<boolean> {
        try {
            // 1. Get Printer Config
            const { data: config } = await supabase
                .from('printer_config')
                .select('*')
                .limit(1)
                .maybeSingle();

            // 2. Get Order
            const { data: order, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    client:clients(name),
                    items:order_items(quantity, unit_price, catalog_item:catalog_items(name))
                `)
                .eq('id', orderId)
                .single();

            if (error || !order) {
                console.error('[PrinterService] Order not found:', error);
                return false;
            }

            const rawContent = this.generateEscPos(order, config);
            const base64Content = Buffer.from(rawContent).toString('base64');

            const { error: queueError } = await supabase
                .from('print_queue')
                .insert({
                    order_id: orderId,
                    raw_content: base64Content,
                    status: 'pending',
                    logo_url: config?.logo_url
                });

            if (queueError) {
                console.error('[PrinterService] Error enqueuing ticket:', queueError);
                return false;
            }

            console.log(`[PrinterService] Ticket enqueued for order #${order.order_number}`);
            return true;
        } catch (err) {
            console.error('[PrinterService] Unexpected error:', err);
            return false;
        }
    }

    /**
     * Generates a raw ESC/POS buffer for 80mm printers.
     */
    private static generateEscPos(order: any, config?: any): Uint8Array {
        const ESC = 0x1B;
        const GS = 0x1D;
        const LF = 0x0A;

        // Default settings if no config found
        const storeName = config?.store_name || 'Azure Culinary Pro';
        const footerMsg = config?.footer_message || '¡Gracias por tu compra!';
        const marginTop = config?.margin_top || 0;
        const marginBottom = config?.margin_bottom || 3;

        let commands: number[] = [
            ESC, 0x40,          // Initialize
            ESC, 0x74, 0x10,    // Code page 16 (WPC1252/Latin 1)
        ];

        // Top Margins
        for (let i = 0; i < marginTop; i++) commands.push(LF);

        commands.push(
            ESC, 0x61, 0x01,    // Center align
            GS, 0x21, 0x11,     // Double height/width
            ...this.strToBytes(`${storeName}\n`),
            GS, 0x21, 0x00,     // Normal size
            ...this.strToBytes('------------------------------------------\n'),
            GS, 0x21, 0x01,     // Double height
            ...this.strToBytes(`ORDEN #${order.order_number}\n`),
            GS, 0x21, 0x00,     // Normal size
            ...this.strToBytes(`${new Date(order.created_at).toLocaleString('es-AR')}\n`),
            ...this.strToBytes(`${order.client?.name || order.chat_context?.pushName || 'Cliente'}\n`),
            ...this.strToBytes(`${order.delivery_type === 'PICKUP' ? '🥡 RETIRO EN LOCAL' : order.delivery_type === 'DELIVERY' ? '🛵 DELIVERY' : '🏪 VENTA MOSTRADOR'}\n`)
        );

        // Address only if it's REALLY a delivery
        if (order.delivery_type === 'DELIVERY' && order.delivery_address) {
            commands.push(...this.strToBytes(`DIR: ${order.delivery_address}\n`));
        }

        commands.push(
            ESC, 0x61, 0x00,    // Left align
            ...this.strToBytes('------------------------------------------\n'),
            ...this.strToBytes(this.formatRow('CANT', 'PRODUCTO', 'SUBTOTAL')),
            ...this.strToBytes('------------------------------------------\n'),
        );

        // Items
        for (const item of order.items) {
            const name = item.catalog_item?.name || 'Producto';
            const qty = `${item.quantity}x`;
            const subtotal = `$${(item.quantity * item.unit_price).toLocaleString('es-AR')}`;
            commands.push(...this.strToBytes(this.formatRow(qty, name, subtotal)));
        }

        commands.push(
            ...this.strToBytes('------------------------------------------\n'),
            ESC, 0x61, 0x02,    // Right align
            GS, 0x21, 0x11,     // Double height/width
            ...this.strToBytes(`TOTAL: $${order.total_amount.toLocaleString('es-AR')}\n`),
            GS, 0x21, 0x00,     // Normal size
            ESC, 0x61, 0x01,    // Center
            LF,
            ...this.strToBytes(`${footerMsg}\n`)
        );

        // Bottom Margins
        for (let i = 0; i < marginBottom; i++) commands.push(LF);
        
        commands.push(
            GS, 0x56, 0x00      // Full cut
        );

        return new Uint8Array(commands);
    }

    private static strToBytes(str: string): number[] {
        // Simple conversion for basic characters. 
        // For special characters like Ñ or tildes, we assume Code Page 1252 is set above.
        const buffer = Buffer.from(str, 'latin1');
        return Array.from(buffer);
    }

    private static formatRow(col1: string, col2: string, col3: string): string {
        const c1w = 6;
        const c3w = 12;
        const c2w = this.COLUMN_WIDTH - c1w - c3w;

        const p1 = col1.padEnd(c1w);
        const p2 = col2.length > c2w ? col2.substring(0, c2w - 1) + ' ' : col2.padEnd(c2w);
        const p3 = col3.padStart(c3w);

        return p1 + p2 + p3 + '\n';
    }
}
