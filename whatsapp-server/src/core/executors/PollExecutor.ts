import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class PollExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        const question = data.question || '¿Qué opción elegís?';
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
