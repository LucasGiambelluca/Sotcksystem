import { NodeExecutor, ExecutionContext, NodeExecutionResult } from './types';

export class SendCatalogExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        const baseUrl = process.env.FRONTEND_URL || 'https://stock-system-catalog.app';
        const catalogUrl = `${baseUrl}/catalog`;

        const message = data.customMessage
            ? `${data.customMessage}\n\n👉 ${catalogUrl}`
            : `¡Mirá nuestro catálogo online! Podés ver todos nuestros productos, elegir lo que querés y hacer tu pedido fácilmente:\n\n👉 ${catalogUrl}`;

        // After sending the catalog link, WAIT for the user to send back
        // the WhatsApp catalog message (e.g. "Hamburguesa x2 — $40")
        return {
            messages: [message],
            wait_for_input: true,  // <-- PAUSE here, wait for catalog reply
        };
    }
}
