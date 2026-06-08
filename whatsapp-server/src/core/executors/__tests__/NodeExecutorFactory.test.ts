import { describe, it, expect, vi } from 'vitest';

// ProductSearchExecutor does a top-level ES import of ProductService,
// which in turn imports repositories.ts which does require('../../config/database').
// Mock ProductService to break that chain.
vi.mock('../../../services/ProductService', () => ({
  productService: {
    getProducts: vi.fn().mockResolvedValue([]),
    findProduct: vi.fn().mockResolvedValue(null),
  },
  default: {
    getProducts: vi.fn().mockResolvedValue([]),
  },
}));

// CatalogExecutor and StockCheckExecutor use top-level require() for ProductService
// which vitest cannot intercept via vi.mock for require calls — mock the executors directly.
vi.mock('../CatalogExecutor', () => ({
  CatalogExecutor: class {
    async execute() { return { messages: [], wait_for_input: false }; }
  },
}));

vi.mock('../StockCheckExecutor', () => ({
  StockCheckExecutor: class {
    async execute() { return { messages: [], wait_for_input: false }; }
  },
}));

import { nodeExecutorFactory } from '../NodeExecutorFactory';

describe('NodeExecutorFactory.getExecutor', () => {
  it('returns a safe no-op executor for unknown types instead of throwing', async () => {
    const ex = nodeExecutorFactory.getExecutor('totallyUnknownNode');
    const res = await ex.execute({}, { phone: 'x' } as any, {});
    expect(res.wait_for_input).toBe(false);
    expect(Array.isArray(res.messages)).toBe(true);
  });

  it('still returns the real executor for a known type', () => {
    const ex = nodeExecutorFactory.getExecutor('conditionNode');
    expect(ex).toBeDefined();
  });
});
