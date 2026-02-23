import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class HandoverExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        console.log(`[HandoverExecutor] Triggering human handover for ${context.phone}`);

        // 2. Set the state to PAUSED/HANDOVER so the automated bot stops answering
        await engine.db.from('flow_executions')
            .update({ status: 'HANDOVER', paused_at: new Date().toISOString() })
            .eq('phone', context.phone)
            .eq('status', 'active');

        // 3. Mark the conversation as HANDOVER for the frontend to move it to the Attention tab
        const cleanPhone = context.phone.replace(/[\s\-\+\(\)]/g, '');
        await engine.db.from('whatsapp_conversations')
            .update({ status: 'HANDOVER', updated_at: new Date().toISOString() })
            .eq('phone', cleanPhone);

        // 3. Send confirmation message to the user
        const responseMessage = data.message || 'Te estamos transfiriendo con un asesor humano. Por favor, aguarda un momento.';

        return {
            wait_for_input: true,
            messages: [{ type: 'text', text: responseMessage }]
        };
    }
}
