
import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';
import sessionStore from '../../core/sessionStore';

export class ThreadManagerExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        console.log('[ThreadManager] Executing thread action:', data.action);
        
        try {
            // 1. Get current session
            // We need to fetch it again or update the object directly. 
            // Since context is a copy, we should update the session store.
            const session = await sessionStore.get(context.phone);
            
            if (!session) {
                 return {
                    messages: ["⚠️ Sesión no encontrada."],
                    wait_for_input: false
                };
            }

            // 2. Handle Actions
            const action = data.action || 'HANDOVER';
            let message = '';

            if (action === 'HANDOVER') {
                session.status = 'HANDOVER';
                session.handover_reason = data.reason || 'Solicitud de usuario';
                message = data.message || "⏳ Te estamos transfiriendo con un humano. Por favor espera.";
            } else if (action === 'RESUME') {
                session.status = 'ACTIVE';
                delete session.handover_reason;
                message = data.message || "🤖 El bot ha retomado la conversación.";
            }

            // 3. Save Session
            await sessionStore.save(context.phone, session);

            return {
                messages: [message],
                wait_for_input: false, // Don't wait, just change state
                nextNodeId: data.nextId // Optional: Jump to another node immediately
            };

        } catch (error) {
            console.error('[ThreadManager] Error:', error);
            return {
                messages: ["⚠️ Error al gestionar el hilo de conversación."],
                wait_for_input: false
            };
        }
    }
}
