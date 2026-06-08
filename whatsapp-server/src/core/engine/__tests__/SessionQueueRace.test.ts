import { describe, it, expect } from 'vitest';
import { SessionQueue } from '../session.queue';

describe('SessionQueue timeout race', () => {
  it('does not start a second job concurrently when a timed-out processor later settles', async () => {
    let active = 0;
    let maxConcurrent = 0;
    const slow = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const q = new SessionQueue('sess-1', async (_msg: any) => {
      active++; maxConcurrent = Math.max(maxConcurrent, active);
      await slow(150);
      active--;
      return 'done';
    }, 50); // 50ms timeout, processor takes 150ms (will time out but keep running)

    const p1 = q.enqueue({ text: 'a', context: {}, options: {} }).catch(() => 'timeout');
    const p2 = q.enqueue({ text: 'b', context: {}, options: {} }).catch(() => 'timeout');
    await Promise.all([p1, p2, slow(400)]);
    expect(maxConcurrent).toBe(1);
  });
});
