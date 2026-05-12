import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import Jimp from 'jimp';

/**
 * PrinterService
 * Handles the generation of ESC/POS commands for thermal printers (80mm).
 * Stores formatted tickets in a Supabase queue to be consumed by a local bridge.
 */
export class PrinterService {
    private static async processLogo(url: string, paperWidth: number = 80): Promise<number[] | null> {
        try {
            console.log(`[PRINTER-LOG] Starting processLogo for URL: ${url} (Paper: ${paperWidth}mm)`);
            const image = await Jimp.read(url);
            
            if (!image) return null;

            // Resize according to paper width: 80mm -> 384px, 58mm -> 288px (common standards)
            const targetWidth = paperWidth === 58 ? 288 : 384;
            image.resize(targetWidth, Jimp.AUTO);
            image.greyscale();
            image.contrast(0.9);

            const width = image.bitmap.width;
            const height = image.bitmap.height;
            const widthBytes = Math.ceil(width / 8);

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
            console.error(`[PRINTER-LOG] processLogo error: ${err.message}`);
            return null;
        }
    }

    static async queueOrderTicket(orderId: string): Promise<boolean> {
        try {
            const { data: config } = await supabase
                .from('printer_config')
                .select('*')
                .limit(1)
                .maybeSingle();
            
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

            if (error || !order) return false;

            const rawContent = await this.generateEscPos(order, config);
            const base64Content = Buffer.from(rawContent).toString('base64');

            await supabase
                .from('print_queue')
                .insert({
                    order_id: orderId,
                    raw_content: base64Content,
                    status: 'pending',
                    logo_url: config?.print_logo ? config?.logo_url : null
                });

            return true;
        } catch (err: any) {
            console.error('[PRINTER-LOG] Error:', err);
            return false;
        }
    }

    private static async generateEscPos(order: any, config?: any): Promise<Uint8Array> {
        const ESC = 0x1B;
        const GS = 0x1D;
        const LF = 0x0A;

        const paperWidth = config?.paper_width || 80;
        const colWidth = paperWidth === 58 ? 32 : 42;
        const separator = '-'.repeat(colWidth) + '\n';

        const storeName = config?.store_name || 'StockSystem';
        const footerMsg = config?.footer_message || '¡Gracias por tu compra!';
        const marginTop = config?.margin_top || 0;
        const marginBottom = config?.margin_bottom || 1;

        let commands: number[] = [
            ESC, 0x40,          // Initialize
            ESC, 0x74, 0x10,    // Code page 16
        ];

        // Logo
        if (config?.print_logo && config?.logo_url) {
            const logoBytes = await this.processLogo(config.logo_url, paperWidth);
            if (logoBytes) {
                commands.push(ESC, 0x61, 0x01); // Center
                commands.push(...logoBytes);
                commands.push(LF);
            }
        }

        for (let i = 0; i < marginTop; i++) commands.push(LF);

        commands.push(
            ESC, 0x61, 0x01,    // Center align
            GS, 0x21, 0x11,     // Double height/width
            ...this.strToBytes(`${storeName}\n`),
            GS, 0x21, 0x00,     // Normal size
            ...this.strToBytes(separator),
            GS, 0x21, 0x01,     // Double height
            ...this.strToBytes(`ORDEN #${order.order_number}\n`),
            GS, 0x21, 0x00,     // Normal size
            ...this.strToBytes(`${new Date(order.created_at).toLocaleString('es-AR')}\n`),
            ...this.strToBytes(`${this.extractCustomerName(order)}\n`),
            ...this.strToBytes(`${order.delivery_type === 'PICKUP' ? '🥡 RETIRO EN LOCAL' : order.delivery_type === 'DELIVERY' ? '🛵 DELIVERY' : '🏪 VENTA MOSTRADOR'}\n`)
        );

        if (order.delivery_type === 'DELIVERY' && order.delivery_address) {
            commands.push(...this.strToBytes(`DIR: ${order.delivery_address}\n`));
        }

        commands.push(
            ESC, 0x61, 0x00,    // Left align
            ...this.strToBytes(separator),
            ...this.strToBytes(this.formatRow('CANT', 'PRODUCTO', 'SUBTOTAL', colWidth)),
            ...this.strToBytes(separator),
        );

        for (const item of order.items) {
            const name = item.catalog_item?.name || 'Producto';
            const qty = `${item.quantity}x`;
            const subtotal = `$${(item.quantity * item.unit_price).toLocaleString('es-AR')}`;
            commands.push(...this.strToBytes(this.formatItemRow(qty, name, subtotal, colWidth)));
        }

        if (config?.print_shipping_fee && order.delivery_fee > 0) {
            const sub = order.subtotal || (order.total_amount - order.delivery_fee);
            commands.push(
                ESC, 0x61, 0x02, // Right
                ...this.strToBytes(`Subtotal: $${sub.toLocaleString('es-AR')}\n`),
                ...this.strToBytes(`Envío: $${order.delivery_fee.toLocaleString('es-AR')}\n`),
            );
        }

        commands.push(
            ...this.strToBytes(separator),
            ESC, 0x61, 0x02,    // Right align
            GS, 0x21, 0x11,     // Double height/width
            ...this.strToBytes(`TOTAL: $${order.total_amount.toLocaleString('es-AR')}\n`),
            GS, 0x21, 0x00,     // Normal size
            ESC, 0x61, 0x01,    // Center
            ...this.strToBytes(`${footerMsg}\n`)
        );

        for (let i = 0; i < marginBottom; i++) commands.push(LF);
        commands.push(GS, 0x56, 0x00); // Cut

        return new Uint8Array(commands);
    }

    private static strToBytes(str: string): number[] {
        return Array.from(Buffer.from(str, 'latin1'));
    }

    private static formatRow(col1: string, col2: string, col3: string, totalWidth: number): string {
        const c1w = 5;
        const c3w = 10;
        const c2w = totalWidth - c1w - c3w;
        return col1.padEnd(c1w) + col2.padEnd(c2w).substring(0, c2w) + col3.padStart(c3w) + '\n';
    }

    private static extractCustomerName(order: any): string {
        let name = order.client?.name || order.chat_context?.pushName;
        if (order.channel === 'TABLET' && order.notes) {
            const match = order.notes.match(/(?:Nombre|Cliente):\s*(.+)/i);
            if (match) name = match[1].trim();
        }
        return name || 'Cliente';
    }

    private static formatItemRow(qty: string, name: string, subtotal: string, totalWidth: number): string {
        const c1w = 5;
        const c3w = 10;
        const c2w = totalWidth - c1w - c3w;

        let output = qty.padEnd(c1w) + name.substring(0, c2w).padEnd(c2w) + subtotal.padStart(c3w) + '\n';
        let remaining = name.substring(c2w);
        while (remaining.length > 0) {
            output += ' '.repeat(c1w) + remaining.substring(0, c2w) + '\n';
            remaining = remaining.substring(c2w);
        }
        return output;
    }
}
