import { describe, it, expect } from 'vitest';
import { ClearCartExecutor } from '../ClearCartExecutor';

describe('ClearCartExecutor', () => {
  it('zeroes the canonical total_amount variable', async () => {
    const ex = new ClearCartExecutor();
    const res = await ex.execute({}, { phone: 'x' } as any, {});
    expect(res.updatedContext?.total_amount).toBe(0);
    expect(res.updatedContext?.order_items).toEqual([]);
  });
});
