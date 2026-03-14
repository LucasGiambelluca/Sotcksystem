import { describe, it, expect, vi } from 'vitest';
import { SessionQueue } from '../session.queue';

describe('SessionQueue', () => {
  it('should process messages in FIFO order', async () => {
    const results: number[] = [];
    const processor = async (val: number) => {
      // Simulate variable work time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
      results.push(val);
      return val * 2;
    };

    const queue = new SessionQueue('test-session', processor);

    // Enqueue multiple messages without waiting
    const p1 = queue.enqueue(1);
    const p2 = queue.enqueue(2);
    const p3 = queue.enqueue(3);

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(results).toEqual([1, 2, 3]);
    expect(r1).toBe(2);
    expect(r2).toBe(4);
    expect(r3).toBe(6);
  });

  it('should ensure sequential processing (no overlap)', async () => {
    let activeTasks = 0;
    let maxConcurrent = 0;

    const processor = async () => {
      activeTasks++;
      maxConcurrent = Math.max(maxConcurrent, activeTasks);
      await new Promise(resolve => setTimeout(resolve, 20));
      activeTasks--;
    };

    const queue = new SessionQueue('test-concurrent', processor);

    await Promise.all([
      queue.enqueue({}),
      queue.enqueue({}),
      queue.enqueue({}),
      queue.enqueue({})
    ]);

    expect(maxConcurrent).toBe(1);
    expect(activeTasks).toBe(0);
  });

  it('should handle errors without blocking subsequent jobs', async () => {
    const results: string[] = [];
    const processor = async (val: string) => {
      if (val === 'fail') throw new Error('Simulated failure');
      results.push(val);
    };

    const queue = new SessionQueue('test-error', processor);
    queue.on('error', () => {}); // Prevent unhandled error event crash

    const p1 = queue.enqueue('first');
    const p2 = queue.enqueue('fail');
    const p3 = queue.enqueue('third');

    await expect(p1).resolves.toBeUndefined();
    await expect(p2).rejects.toThrow('Simulated failure');
    await expect(p3).resolves.toBeUndefined();

    expect(results).toEqual(['first', 'third']);
  });

  it('should timeout if processor takes too long', async () => {
    const processor = async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    };

    // Set a very short timeout
    const queue = new SessionQueue('test-timeout', processor, 50);

    await expect(queue.enqueue({})).rejects.toThrow(/Timeout processing message/);
  });
});
