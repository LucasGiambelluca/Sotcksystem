
import PDFDocument from 'pdfkit';
import { Stream } from 'stream';

export class PdfService {
    
    /**
     * Generates a PDF receipt for an order.
     * @param order The order object containing details.
     * @returns A Promise that resolves to a Buffer containing the PDF.
     */
    async generateOrderReceipt(order: any): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 50 });
                const buffers: Buffer[] = [];

                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                // --- Header ---
                doc.fontSize(20).text('Comprobante de Pedido', { align: 'center' });
                doc.moveDown();
                doc.fontSize(12).text(`Orden #: ${order.order_number || order.id?.slice(0, 8)}`);
                doc.text(`Fecha: ${new Date().toLocaleString()}`);
                doc.text(`Cliente: ${order.pushName || order.phone}`);
                if (order.address) doc.text(`Dirección: ${order.address}`);
                if (order.deliveryDate) doc.text(`Entrega: ${order.deliveryDate}`);
                doc.moveDown();

                // --- Items ---
                doc.fontSize(14).text('Detalle:', { underline: true });
                doc.moveDown(0.5);

                const rawItems = order.items;
                const items = Array.isArray(rawItems) ? rawItems : [];
                let total = 0;

                if (items.length === 0) {
                    doc.fontSize(12).text('(Sin productos detallados)');
                }

                items.forEach((item: any) => {
                    const qty = item.qty || item.quantity || 1;
                    const lineTotal = (item.price || 0) * qty;
                    total += lineTotal;
                    doc.fontSize(12).text(
                        `${qty}x ${item.name || 'Producto'} - $${lineTotal}`
                    );
                });

                doc.moveDown();
                
                // --- Total ---
                doc.fontSize(16).text(`Total: $${total}`, { align: 'right' });
                
                // --- Footer ---
                doc.moveDown(2);
                doc.fontSize(10).text('Gracias por tu compra en KitchenFlow!', { align: 'center' });

                doc.end();

            } catch (err) {
                reject(err);
            }
        });
    }
}

export default new PdfService();
