import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';
import { logger } from '../../utils/logger';

export class ClearCartExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        logger.info(`[ClearCartExecutor] Clearing cart for session.`);
        
        const message = data.message || "🧹 Tu carrito ha sido vaciado correctamente.";

        return {
            messages: [message],
            wait_for_input: false,
            updatedContext: {
                order_items: [],
                total_order: 0,
                location_validated: false // Optionally reset this too if needed
            }
        };
    }
}
