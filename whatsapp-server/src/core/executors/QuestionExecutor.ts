import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class QuestionExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        // Si la variable ya está en el contexto (ej: vino pre-cargada desde el catálogo), salteamos la pregunta
        if (data.variable && context[data.variable]) {
            console.log(`[QuestionExecutor] Saltando pregunta '${data.name}' porque ${data.variable} ya tiene valor: ${context[data.variable]}`);
            return { messages: [], wait_for_input: false };
        }

        // Si no, enviamos la pregunta y esperamos
        return {
            messages: [data.question],
            wait_for_input: true
            // El input se guardará en flow.engine.ts al recibirlo, usando data.variable
        };
    }
}
