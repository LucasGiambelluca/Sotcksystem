import { describe, it, expect, vi } from 'vitest';

// The executor calls require('../../config/database') INSIDE its methods.
// vitest's vi.mock cannot intercept CommonJS require(), so instead we mock the
// underlying libraries that config/database.ts imports, and make the resulting
// supabase client return ERRORS for every query — exercising the guard paths.
vi.mock('@supabase/supabase-js', () => {
  const chain: any = {
    from: () => chain,
    select: () => chain,
    // draft_orders shape: .from().select().eq().single()
    single: async () => ({ data: null, error: { message: 'down' } }),
  };
  // catalog_items shape: .from().select().eq()  -> awaitable AND chainable
  chain.eq = () =>
    Object.assign(Promise.resolve({ data: [], error: { message: 'down' } }), chain);
  return {
    createClient: () => chain,
  };
});

vi.mock('ioredis', () => {
  class FakeRedis {
    on() {}
    quit() {}
  }
  return { default: FakeRedis };
});

import { OrderValidatorExecutor } from '../OrderValidatorExecutor';

describe('OrderValidatorExecutor robustness', () => {
  it('does not crash when an item has no name', async () => {
    const ex = new OrderValidatorExecutor();
    const ctx: any = { phone: 'x', order_items: [{ qty: 1, price: 100 }] }; // no name
    const res = await ex.execute({}, ctx, {});
    expect(res).toBeDefined();
    expect(Array.isArray(res.messages)).toBe(true);
  });

  it('does not crash when a Supabase query errors out', async () => {
    const ex = new OrderValidatorExecutor();
    const ctx: any = { phone: 'x', order_items: [{ qty: 2, price: 50, name: 'Pollo h' }] };
    const res = await ex.execute({}, ctx, {});
    expect(res).toBeDefined();
    expect(Array.isArray(res.messages)).toBe(true);
  });

  it('handleInput does not crash when catalog_items query errors out', async () => {
    const ex = new OrderValidatorExecutor();
    const ctx: any = { phone: 'x' };
    const res = await ex.handleInput('5', {}, ctx);
    expect(res).toBeDefined();
  });
});
