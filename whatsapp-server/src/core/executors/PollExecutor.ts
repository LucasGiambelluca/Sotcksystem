import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class PollExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        const varName = data.variable || data.contextKey || 'poll_response';

        // Solo salteamos si explícitamente se permite en el nodo Y ya tiene valor
        if (data.allow_skip && context[varName]) {
            console.log(`[PollExecutor] Saltando encuesta '${data.name}' porque allow_skip es true y ${varName} ya tiene valor.`);
            return { messages: [], wait_for_input: false };
        }

        // Caso normal: renderizamos la encuesta
        const question = data.question || "Elige una opción:";
        const options = data.options || ['Sí', 'No'];

        // Build a text-based numbered menu (much more reliable than native WhatsApp polls)
        const optionLines = options.map((opt: string, i: number) => {
            const cleanOpt = opt.replace(/^\d+[\s.)-]*\s*/, '');
            return `*${i + 1}.* ${cleanOpt}`;
        }).join('\n');
        const menuText = `${question}\n\n${optionLines}\n\n_Respondé con el número de tu elección._`;

        return {
            messages: [menuText],
            wait_for_input: true
        };
    }
}
