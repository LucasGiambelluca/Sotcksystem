import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class QuestionExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        // Envia la pregunta y espera
        return {
            messages: [data.question],
            wait_for_input: true
            // El input se guardará en flow.engine.ts al recibirlo, usando data.variable
        };
    }
}
