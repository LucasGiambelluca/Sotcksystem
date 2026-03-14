import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowEngine } from '../flow.engine';
import { supabase } from '../../../config/database';
import { logger } from '../../../utils/logger';

// 1. Mock top-level
vi.mock('../../../config/database', () => ({
    supabase: {
        from: vi.fn()
    }
}));

vi.mock('../../executors/NodeExecutorFactory', () => ({
  nodeExecutorFactory: {
    getExecutor: vi.fn(() => ({
      execute: vi.fn().mockResolvedValue({ messages: ['Mock'], wait_for_input: false })
    }))
  }
}));

describe('FlowEngine Concurrency Integration', () => {
  let engine: FlowEngine;
  let updateSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    updateSpy = vi.fn();

    (supabase.from as any).mockImplementation((table: string) => {
        const query: any = {};
        query.select = vi.fn().mockReturnValue(query);
        query.eq = vi.fn().mockReturnValue(query);
        query.in = vi.fn().mockReturnValue(query);
        query.or = vi.fn().mockReturnValue(query);
        query.order = vi.fn().mockReturnValue(query);
        query.limit = vi.fn().mockReturnValue(query);
        query.insert = vi.fn().mockReturnValue(query);
        
        query.update = vi.fn().mockImplementation(() => {
            updateSpy();
            return query;
        });

        query.single = vi.fn().mockResolvedValue({ 
            data: table === 'flows' ? { id: 'f1', nodes: [{ id: 'n1', type: 'messageNode' }] } : {}, 
            error: null 
        });
        query.maybeSingle = vi.fn().mockResolvedValue({ 
            data: table === 'flow_executions' ? { session_id: 's1', phone: '123', status: 'active', context: { metadata: { flowId: 'f1' } } } : null, 
            error: null 
        });

        const originalSelect = query.select;
        query.select.mockImplementation(() => {
            if (query.update.mock.calls.length > 0) {
                return Promise.resolve({ data: [{}], error: null });
            }
            return query;
        });

        return query;
    });

    vi.spyOn(logger, 'info').mockImplementation(() => logger as any);
    vi.spyOn(logger, 'error').mockImplementation(() => logger as any);
    
    engine = new FlowEngine();
  });

  it('should process concurrent messages sequentially', async () => {
    const phone = '123456789';
    await engine.processMessage(phone, 'msg1', { remoteJid: '123@s.whatsapp.net' });
    await engine.processMessage(phone, 'msg2', { remoteJid: '123@s.whatsapp.net' });
    expect(updateSpy).toHaveBeenCalledTimes(2);
  });
});
