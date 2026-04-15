import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';
import { AIService } from '../../services/AIService';
import { logger } from '../../utils/logger';

/**
 * AudioTranscriberExecutor:
 * If the incoming message was an audio note (already transcribed by the WhatsApp layer),
 * it stores the transcription in a variable. If NOT audio, it passes through silently.
 * 
 * This node is mainly for visual flow clarity — the actual transcription happens
 * in the WhatsApp message handler, but this node lets flow builders explicitly
 * acknowledge and route audio messages.
 */
export class AudioTranscriberExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        const outputVariable = data.output_variable || 'transcripcion';
        const isAudio = context._isAudio === true;

        if (isAudio) {
            // The audio was already transcribed at the WhatsApp layer
            // The current message text IS the transcription
            const transcription = context.raw_user_message || context.user_choice || '';
            logger.info(`[AudioTranscriber] Audio detected. Transcription: "${transcription.substring(0, 80)}"`);

            return {
                messages: [],
                wait_for_input: false,
                updatedContext: {
                    [outputVariable]: transcription,
                    _was_audio: true,
                },
            };
        }

        // Not an audio message — pass through
        logger.debug(`[AudioTranscriber] No audio detected, passing through.`);
        return {
            messages: [],
            wait_for_input: false,
            updatedContext: {
                [outputVariable]: context.raw_user_message || '',
                _was_audio: false,
            },
        };
    }
}
