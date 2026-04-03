import { logger } from '../../utils/logger';

export enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
    private failures = 0;
    private lastFailureTime = 0;
    private state: CircuitState = CircuitState.CLOSED;
    
    // Configuration
    private readonly THRESHOLD = 3;
    private readonly TIMEOUT_MS = 30000; // 30s cooldown
    private readonly EXECUTION_TIMEOUT = 1200; // 1.2s max for AI response

    async execute<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailureTime > this.TIMEOUT_MS) {
                logger.warn('[CircuitBreaker] Mode: HALF_OPEN - Testing recovery');
                this.state = CircuitState.HALF_OPEN;
            } else {
                logger.info('[CircuitBreaker] Mode: OPEN - Using survival fallback (Local Regex)');
                return fallback();
            }
        }

        try {
            // Promise.race to handle internal timeouts
            const result = await Promise.race([
                fn(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('TIMEOUT')), this.EXECUTION_TIMEOUT)
                )
            ]) as T;
            
            this.onSuccess();
            return result;
        } catch (error: any) {
            logger.error(`[CircuitBreaker] Execution failure: ${error.message}`);
            this.onFailure();
            return fallback();
        }
    }

    private onSuccess() {
        this.failures = 0;
        this.state = CircuitState.CLOSED;
    }

    private onFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.failures >= this.THRESHOLD) {
            logger.error(`[CircuitBreaker] Threshold reached (${this.failures}). Opening circuit! 🚨`);
            this.state = CircuitState.OPEN;
        }
    }

    public getState(): CircuitState {
        return this.state;
    }
}

// Singleton instance for the bot
export const aiCircuitBreaker = new CircuitBreaker();
