import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import Jimp from 'jimp';

/**
 * PrinterService
 * Handles the generation of ESC/POS commands for thermal printers (80mm).
 * Stores formatted tickets in a Supabase queue to be consumed by a local bridge.
 */
export class PrinterService {
    private static COLUMN_WIDTH = 42; // Standard for 80mm (Font A)

    private static async processLogo(url: string): Promise<number[] | null> {
        try {
            logger.info(`[PrinterService] Processing logo from URL: ${url}`);
            const image = await Jimp.read(url);
            
            if (!image) {
                logger.error('[PrinterService] Jimp could not read the image.');
                return null;
            }

            // Standard for 80mm
            image.resize(384, Jimp.AUTO);
            image.greyscale();
            image.contrast(0.9); // Increase contrast for thermal printing

            const width = image.bitmap.width;
            const height = image.bitmap.height;
            const widthBytes = Math.ceil(width / 8);

            logger.info(`[PrinterService] Logo processed: ${width}x${height} (${widthBytes} bytes wide)`);

            // GS v 0 0 xL xH yL yH d1...dk
            const commands: number[] = [
                0x1D, 0x76, 0x30, 0x00,
                widthBytes & 0xFF, (widthBytes >> 8) & 0xFF,
                height & 0xFF, (height >> 8) & 0xFF
            ];

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < widthBytes; x++) {
                    let byte = 0;
                    for (let bit = 0; bit < 8; bit++) {
                        const pixelX = x * 8 + bit;
                        if (pixelX < width) {
                            const rgba = Jimp.intToRGBA(image.getPixelColor(pixelX, y));
                            const brightness = (rgba.r + rgba.g + rgba.b) / 3;
                            if (brightness < 128) {
                                byte |= (1 << (7 - bit));
                            }
                        }
                    }
                    commands.push(byte);
                }
            }

            return commands;
        } catch (err: any) {
            logger.error(`[PrinterService] Error processing logo: ${err.message}`);
            return null;
        }
    }

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
                    items:order_items(
                        quantity, 
                        unit_price, 
                        catalog_item:catalog_items(name, description)
                    )
                `)
                .eq('id', orderId)
                .single();

            if (error || !order) {
                logger.error('[PrinterService] Order not found:', error);
                return false;
            }

            const rawContent = await this.generateEscPos(order, config);
            const base64Content = Buffer.from(rawContent).toString('base64');

            const { error: queueError } = await supabase
                .from('print_queue')
                .insert({
                    order_id: orderId,
                    raw_content: base64Content,
                    status: 'pending',
                    logo_url: config?.print_logo ? config?.logo_url : null
                });

            if (queueError) {
                logger.error('[PrinterService] Error enqueuing ticket:', queueError);
                return false;
            }

            logger.info(`[PrinterService] Ticket enqueued for order #${order.order_number}`);
            return true;
        } catch (err) {
            logger.error('[PrinterService] Unexpected error:', err);
            return false;
        }
    }

    /**
     * Generates a raw ESC/POS buffer for 80mm printers.
     */
    private static async generateEscPos(order: any, config?: any): Promise<Uint8Array> {
        const ESC = 0x1B;
        const GS = 0x1D;
        const LF = 0x0A;

        // Default settings if no config found
        const storeName = config?.store_name || 'Azure Culinary Pro';
        const footerMsg = config?.footer_message || '¡Gracias por tu compra!';
        const marginTop = config?.margin_top || 0;
        const marginBottom = config?.margin_bottom || 1;

        let commands: number[] = [
            ESC, 0x40,          // Initialize
            ESC, 0x74, 0x10,    // Code page 16 (WPC1252/Latin 1)
        ];

        // --- NEW: LOGO PROCESSING ---
        if (config?.print_logo && config?.logo_url) {
            try {
                const logoBytes = await this.processLogo(config.logo_url);
                if (logoBytes) {
                    commands.push(ESC, 0x61, 0x01); // Center
                    commands.push(...logoBytes);
                    commands.push(LF);
                }
            } catch (err) {
                logger.error('[PrinterService] Logo processing failed:', err);
            }
        }

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
            ...this.strToBytes(`${this.extractCustomerName(order)}\n`),
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
            
            // Format item with potential multi-line name (NO description per user request)
            commands.push(...this.strToBytes(this.formatItemRow(qty, name, subtotal)));
        }

        // Shipping Fee if applicable
        if (config?.print_shipping_fee && order.delivery_fee > 0) {
            const sub = order.subtotal || (order.total_amount - order.delivery_fee);
            commands.push(
                ESC, 0x61, 0x02, // Right
                ...this.strToBytes(`Subtotal: $${sub.toLocaleString('es-AR')}\n`),
                ...this.strToBytes(`Envío: $${order.delivery_fee.toLocaleString('es-AR')}\n`),
            );
        }

        commands.push(
            ...this.strToBytes('------------------------------------------\n'),
            ESC, 0x61, 0x02,    // Right align
            GS, 0x21, 0x11,     // Double height/width
            ...this.strToBytes(`TOTAL: $${order.total_amount.toLocaleString('es-AR')}\n`),
            GS, 0x21, 0x00,     // Normal size
            ESC, 0x61, 0x01,    // Center
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

    private static extractCustomerName(order: any): string {
        let name = order.client?.name || order.chat_context?.pushName;
        
        // Priority for Tablet orders with custom names in notes
        if (order.channel === 'TABLET' && order.notes) {
            const match = order.notes.match(/(?:Nombre|Cliente):\s*(.+)/i);
            if (match) name = match[1].trim();
        }

        return name || 'Cliente';
    }

    private static formatItemRow(qty: string, name: string, subtotal: string): string {
        const c1w = 6;
        const c3w = 12;
        const c2w = this.COLUMN_WIDTH - c1w - c3w; // 24 chars for 80mm

        let output = '';
        
        // 1. Primary Line (Qty, Start of Name, Subtotal)
        const p1 = qty.padEnd(c1w);
        const p3 = subtotal.padStart(c3w);
        
        if (name.length <= c2w) {
            output += p1 + name.padEnd(c2w) + p3 + '\n';
        } else {
            // Split name into first line and remaining
            output += p1 + name.substring(0, c2w) + p3 + '\n';
            let remaining = name.substring(c2w);
            while (remaining.length > 0) {
                output += ' '.repeat(c1w) + remaining.substring(0, c2w) + '\n';
                remaining = remaining.substring(c2w);
            }
        }

        return output;
    }
}
