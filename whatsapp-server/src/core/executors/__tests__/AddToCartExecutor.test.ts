import { describe, it, expect } from 'vitest';
import { AddToCartExecutor } from '../AddToCartExecutor';

describe('AddToCartExecutor validation', () => {
  it('clamps qty to at least 1 for negative input', async () => {
    const ex = new AddToCartExecutor();
    const ctx: any = { phone: 'x', stock_result: { found: true, product_id: 'p1', product_name: 'Pollo', price: 100 }, cantidad: '-3' };
    const res = await ex.execute({}, ctx, {});
    expect(res.updatedContext?.order_items?.[0].qty).toBeGreaterThanOrEqual(1);
    expect(res.updatedContext?.total_amount).toBeGreaterThanOrEqual(0);
  });

  it('never produces NaN total when price missing', async () => {
    const ex = new AddToCartExecutor();
    const ctx: any = { phone: 'x', stock_result: { found: true, product_id: 'p2', product_name: 'X' }, cantidad: '2' };
    const res = await ex.execute({}, ctx, {});
    expect(Number.isNaN(res.updatedContext?.total_amount)).toBe(false);
  });
});
