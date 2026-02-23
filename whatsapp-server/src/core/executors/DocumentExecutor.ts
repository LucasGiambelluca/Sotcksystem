
import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';
import pdfService from '../../services/PdfService';

export class DocumentExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        console.log('[DocumentExecutor] Generating PDF...');
        
        try {
            // Build order object for PDF, merging DB order with items from context
            const dbOrder = context.created_order;
            const orderItems = Array.isArray(context.order_items) ? context.order_items : [];
            
            const deliveryDate = dbOrder?.delivery_date || dbOrder?.chat_context?.delivery_date || context.delivery_date || context.fecha || context.fecha_entrega;
            
            const order = {
                id: dbOrder?.id || dbOrder?.order_number || ('PREVIEW-' + Date.now()),
                order_number: dbOrder?.order_number,
                items: orderItems,
                total: dbOrder?.total_amount || orderItems.reduce((s: number, i: any) => s + ((i.price || 0) * (i.qty || i.quantity || 1)), 0),
                pushName: context.pushName || dbOrder?.phone,
                phone: context.phone,
                address: dbOrder?.delivery_address || context.direccion || context.address || context.domicilio,
                deliveryDate: deliveryDate
            };
            
            console.log('[DocumentExecutor] Order for PDF:', { id: order.id, itemCount: order.items.length, total: order.total });

            // 2. Generate PDF Buffer
            const pdfBuffer = await pdfService.generateOrderReceipt(order);
            
            // 3. Construct Response
            return {
                messages: [
                    {
                        text: "📄 *Generando comprobante...*"
                    },
                    {
                        document: pdfBuffer,
                        mimetype: 'application/pdf',
                        fileName: `Pedido_${order.id}.pdf`,
                        caption: 'Aquí tienes tu comprobante.'
                    }
                ],
                wait_for_input: false
            };

        } catch (error) {
            console.error('[DocumentExecutor] Error generating PDF:', error);
            return {
                messages: ["⚠️ Hubo un error generando el comprobante."],
                wait_for_input: false
            };
        }
    }
}
