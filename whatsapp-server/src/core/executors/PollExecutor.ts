import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class PollExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        const varName = data.variable || data.contextKey || 'poll_response';

        // Si la variable de la encuesta ya vino pre-cargada en el contexto (ej: desde el catálogo web)
        if (context[varName]) {
            console.log(`[PollExecutor] Saltando encuesta '${data.name}' porque ${varName} ya tiene valor: ${context[varName]}`);
            return { messages: [], wait_for_input: false };
        }

        // Caso normal: renderizamos la encuesta
        const question = data.question || "Elige una opción:";
        const options = data.options || ['Sí', 'No'];

        // Build a text-based numbered menu (much more reliable than native WhatsApp polls)
        const optionLines = options.map((opt: string, i: number) => `*${i + 1}.* ${opt}`).join('\n');
        const menuText = `${question}\n\n${optionLines}\n\n_Respondé con el número de tu elección._`;

        return {
            messages: [menuText],
            wait_for_input: true
        };
    }
}
