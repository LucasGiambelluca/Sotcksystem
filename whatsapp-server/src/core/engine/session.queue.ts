import { EventEmitter } from 'events';
import crypto from 'crypto';

interface QueuedMessage {
  id: string;
  message: any;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  enqueuedAt: number;
}

export class SessionQueue extends EventEmitter {
  private queue: QueuedMessage[] = [];
  private processing = false;
  private currentJobId: string | null = null;
  private timeoutMs: number;

  constructor(
    private sessionId: string,
    private processor: (message: any) => Promise<any>,
    timeoutMs: number = 45000 // 45s default timeout
  ) {
    super();
    this.timeoutMs = timeoutMs;
  }

  /**
   * Add message to the queue
   */
  async enqueue(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const job: QueuedMessage = {
        id: crypto.randomUUID(),
        message,
        resolve,
        reject,
        enqueuedAt: Date.now()
      };

      this.queue.push(job);
      this.emit('enqueued', { jobId: job.id, queueLength: this.queue.length });
      
      // Start processing if not already doing so
      this.processNext();
    });
  }

  /**
   * Process next message in FIFO order
   */
  private async processNext(): Promise<void> {
    if (this.processing) return;
    if (this.queue.length === 0) return;

    this.processing = true;
    const job = this.queue.shift()!;
    this.currentJobId = job.id;

    const timeout = setTimeout(() => {
      this.emit('timeout', { jobId: job.id, duration: this.timeoutMs });
      job.reject(new Error(`Timeout processing message after ${this.timeoutMs}ms (Session: ${this.sessionId})`));
      this.processing = false;
      this.processNext();
    }, this.timeoutMs);

    const startTime = Date.now();

    try {
      this.emit('processing', { jobId: job.id });
      
      const result = await this.processor(job.message);
      
      const duration = Date.now() - startTime;
      this.emit('completed', { jobId: job.id, duration });
      
      job.resolve(result);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.emit('error', { jobId: job.id, error, duration });
      job.reject(error);
      
    } finally {
      clearTimeout(timeout);
      this.processing = false;
      this.currentJobId = null;
      
      // Schedule next processing on next tick
      setImmediate(() => this.processNext());
    }
  }

  /**
   * Current status for debugging
   */
  getStatus() {
    return {
      sessionId: this.sessionId,
      processing: this.processing,
      currentJobId: this.currentJobId,
      queueLength: this.queue.length,
      waitingJobs: this.queue.map(j => ({ id: j.id, waitingMs: Date.now() - j.enqueuedAt }))
    };
  }

  /**
   * Clear queue (on reset/error)
   */
  clear(): void {
    for (const job of this.queue) {
      job.reject(new Error('Queue cleared by reset/system command'));
    }
    this.queue = [];
  }
}
