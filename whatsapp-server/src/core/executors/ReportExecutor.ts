
import { NodeExecutor, ExecutionContext, NodeExecutionResult } from './types';
import { supabase } from '../../config/database';

export class ReportExecutor implements NodeExecutor {
    async execute(nodeData: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        const descriptionVar = nodeData.variable || 'claim_description';
        const description = context[descriptionVar] || context.temp_input || 'No description provided';
        const type = nodeData.reportType || 'reclamo';
        const priority = nodeData.priority || 'medium';

        console.log(`[ReportExecutor] Creating claim for user ${context.phone}`);

        try {
            // Find client ID from phone
            const { data: client } = await supabase
                .from('clients')
                .select('id')
                .eq('phone', context.phone)
                .single();

            const clientId = client?.id;

            // Create claim
            const { error } = await supabase
                .from('claims')
                .insert({
                    client_id: clientId, // can be null if not found
                    type,
                    description,
                    priority,
                    status: 'open',
                    metadata: {
                        source: 'whatsapp_bot',
                        flow_context: context
                    }
                });

            if (error) {
                console.error("[ReportExecutor] Failed to create claim:", error);
                return {
                    messages: ["⚠️ Hubo un error al registrar tu reporte. Por favor intenta más tarde."],
                    wait_for_input: false
                };
            }

            return {
                messages: nodeData.text ? [nodeData.text] : ["✅ Tu reporte ha sido registrado exitosamente. Nos pondremos en contacto pronto."],
                wait_for_input: false
            };

        } catch (e) {
            console.error("[ReportExecutor] Unexpected error:", e);
            return {
                messages: ["⚠️ Error inesperado al procesar el reporte."],
                wait_for_input: false
            };
        }
    }
}
