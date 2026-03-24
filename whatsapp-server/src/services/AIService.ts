import axios from 'axios';
import { logger } from '../utils/logger';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface AICompletionOptions {
    systemPrompt: string;
    userMessage: string;
    jsonMode?: boolean;
    maxTokens?: number;
    temperature?: number;
}

/**
 * Core AI Service — uses Groq REST API via axios for fast LLM inference.
 * Uses llama-3.3-70b-versatile for best quality/speed balance.
 */
export class AIService {
    private static MODEL = 'llama-3.3-70b-versatile';

    static isAvailable(): boolean {
        return !!GROQ_API_KEY;
    }

    static async complete(options: AICompletionOptions): Promise<string> {
        const { systemPrompt, userMessage, jsonMode = false, maxTokens = 512, temperature = 0.1 } = options;

        try {
            const response = await axios.post(
                GROQ_API_URL,
                {
                    model: AIService.MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    max_tokens: maxTokens,
                    temperature,
                    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
                },
                {
                    headers: {
                        'Authorization': `Bearer ${GROQ_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 10000,
                }
            );

            const content = response.data?.choices?.[0]?.message?.content || '';
            logger.debug(`[AI] Completion OK`, {
                model: AIService.MODEL,
                tokens: response.data?.usage?.total_tokens,
                inputLen: userMessage.length
            });
            return content;
        } catch (err: any) {
            const msg = err.response?.data?.error?.message || err.message;
            logger.error(`[AI] Groq API error`, { error: msg, status: err.response?.status });
            throw new Error(`Groq API: ${msg}`);
        }
    }

    /**
     * Structured JSON extraction — parses the LLM response as JSON.
     * Returns null if parsing fails (graceful degradation).
     */
    static async extractJSON<T = any>(options: AICompletionOptions): Promise<T | null> {
        try {
            const raw = await AIService.complete({ ...options, jsonMode: true });
            return JSON.parse(raw) as T;
        } catch (err: any) {
            logger.warn(`[AI] JSON extraction failed`, { error: err.message });
            return null;
        }
    }
}
