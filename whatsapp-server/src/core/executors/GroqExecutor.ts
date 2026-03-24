import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';
import { AIService } from '../../services/AIService';
import { logger } from '../../utils/logger';

/**
 * GroqExecutor: Calls Groq AI to generate a response or process data within a flow.
 * Supports variable interpolation in the prompt.
 */
export class GroqExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext): Promise<NodeExecutionResult> {
        let prompt = data.prompt || '';
        const systemPrompt = data.systemPrompt || 'Sos un asistente virtual para una rotisería.';
        const targetVariable = data.variable || 'ai_response';

        if (!prompt) {
            return {
                messages: ['⚠️ Error: Nodo Groq sin instrucción (prompt).'],
                wait_for_input: false
            };
        }

        // 1. Interpolate variables: {{varName}}
        prompt = prompt.replace(/\{\{(\w+)\}\}/g, (_: string, varName: string) => {
            return (context as any)[varName] || '';
        });

        try {
            logger.info(`[GroqExecutor] Calling Groq with prompt: "${prompt.substring(0, 50)}..."`);
            
            const response = await AIService.complete({
                systemPrompt,
                userMessage: prompt,
                temperature: data.temperature ?? 0.7,
                maxTokens: data.maxTokens ?? 512
            });

            // 2. Return result
            return {
                messages: data.silent ? [] : [response],
                wait_for_input: false,
                updatedContext: {
                    [targetVariable]: response
                }
            };
        } catch (err: any) {
            logger.error(`[GroqExecutor] Execution failed`, { error: err.message });
            return {
                messages: ['⚠️ Lo siento, mi cerebro de IA tuvo un problema temporal.'],
                wait_for_input: false
            };
        }
    }
}
