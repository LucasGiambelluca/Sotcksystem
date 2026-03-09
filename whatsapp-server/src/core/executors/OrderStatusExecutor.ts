
import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';
import { supabase } from '../../config/database';

export class OrderStatusExecutor implements NodeExecutor {
    async execute(nodeData: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        const orderNumberVar = nodeData.variable || 'order_number';
        const orderNumberRaw = context[orderNumberVar] || context.temp_input;

        if (!orderNumberRaw) {
            return {
                messages: ["⚠️ No se proporcionó un número de orden. Por favor, intenta de nuevo."],
                wait_for_input: false
            };
        }

        // Clean up input (take only numbers)
        const orderNumber = parseInt(String(orderNumberRaw).replace(/\D/g, ''));

        if (isNaN(orderNumber)) {
            return {
                messages: ["⚠️ El número de orden ingresado no es válido. Por favor, ingresá solo los números (ejemplo: 123)."],
                wait_for_input: false
            };
        }

        console.log(`[OrderStatusExecutor] Checking status for order #${orderNumber}`);

        try {
            const { data: order, error } = await supabase
                .from('orders')
                .select('status, created_at')
                .eq('order_number', orderNumber)
                .maybeSingle();

            if (error) {
                console.error("[OrderStatusExecutor] DB error:", error);
                throw error;
            }

            if (!order) {
                return {
                    messages: [`🔍 No pudimos encontrar el pedido #${orderNumber}. ¿Podrías verificar el número?`],
                    wait_for_input: false
                };
            }

            let statusMsg = "";
            const status = order.status.toUpperCase();

            switch (status) {
                case 'PENDING':
                    statusMsg = `🍗 Tu pedido #${orderNumber} ha sido recibido y está esperando ser confirmado por nuestro equipo. ¡En breve entrará a la cocina!`;
                    break;
                case 'CONFIRMED':
                case 'IN_PREPARATION':
                case 'PREPARING':
                    statusMsg = `👨‍🍳 ¡Buenas noticias! Tu pedido #${orderNumber} ya está **en la cocina**. Nuestro equipo lo está preparando con mucho amor.`;
                    break;
                case 'READY':
                case 'FINISHED':
                case 'IN_TRANSIT':
                case 'DISPATCHED':
                    statusMsg = `🛵 ¡Tu pedido #${orderNumber} ya está **listo y despachado**! Debería estar llegando a tu domicilio muy pronto. 🔥`;
                    break;
                case 'DELIVERED':
                    statusMsg = `✅ El pedido #${orderNumber} figura como **ENTREGADO**. ¡Esperamos que lo disfrutes mucho! 😋`;
                    break;
                case 'CANCELLED':
                    statusMsg = `❌ Lo sentimos, el pedido #${orderNumber} figura como **CANCELADO**. Si tenés alguna duda, comunicate con nosotros por atención humana.`;
                    break;
                default:
                    statusMsg = `📋 El estado actual de tu pedido #${orderNumber} es: **${status}**.`;
            }

            return {
                messages: [statusMsg],
                wait_for_input: false
            };

        } catch (e) {
            console.error("[OrderStatusExecutor] Unexpected error:", e);
            return {
                messages: ["⚠️ Hubo un problema al consultar el estado. Por favor, intenta más tarde."],
                wait_for_input: false
            };
        }
    }
}
