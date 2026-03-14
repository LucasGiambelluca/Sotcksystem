import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionRepository } from '../SessionRepository';
import { Session } from '../../../core/domain/Session';
import { supabase } from '../../../config/database';

// Mock Supabase
vi.mock('../../../config/database', () => ({
  supabase: {
    from: vi.fn()
  }
}));

describe('SessionRepository', () => {
  let repository: SessionRepository;
  let mockQuery: any;

  beforeEach(() => {
    repository = new SessionRepository();
    vi.clearAllMocks();

    mockQuery = {
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };

    (supabase.from as any).mockReturnValue(mockQuery);
  });

  describe('update', () => {
    it('should perform optimistic locking by checking version', async () => {
      const session = new Session(
        'sess-123', '123', '123',
        { 
          variables: { global: { phoneNumber: '123', chatJid: '123', startedAt: 'now' } },
          interactionLog: [],
          metadata: { flowId: 'f', flowVersion: 1, entryPoint: 'trigger' }
        },
        'node-1', 'active', new Date(), 5
      );

      mockQuery.update.mockReturnValue(mockQuery);
      mockQuery.select.mockResolvedValue({ data: [{ id: 'updated' }], error: null });

      await repository.update(session);

      expect(mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({ version: 6 }));
      expect(mockQuery.eq).toHaveBeenCalledWith('session_id', 'sess-123');
      expect(mockQuery.eq).toHaveBeenCalledWith('version', 5);
    });

    it('should throw CONCURRENCY_CONFLICT if update returns no rows', async () => {
      const session = new Session(
        'sess-conflict', '123', '123',
        { variables: { global: { phoneNumber: '123', chatJid: '123', startedAt: 'now' } } } as any,
        'start', 'active', new Date(), 1
      );

      mockQuery.update.mockReturnValue(mockQuery);
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      await expect(repository.update(session)).rejects.toThrow('CONCURRENCY_CONFLICT');
    });
  });

  describe('getOrCreate', () => {
    it('should return existing session if active and not expired', async () => {
      const now = new Date();
      const existingData = {
        session_id: 'active-1',
        phone: '123',
        status: 'active',
        context: { 
            variables: { global: { phoneNumber: '123', chatJid: '123', startedAt: 'now' } }, 
            metadata: { flowId: 'flow-1', flowVersion: 1, entryPoint: 'trigger' } 
        },
        current_node_id: 'node-A',
        last_activity: now.toISOString(),
        version: 10
      };

      mockQuery.maybeSingle.mockResolvedValue({ data: existingData, error: null });

      const session = await repository.getOrCreate('active-1', '123', 'flow-1');

      expect(session.id).toBe('active-1');
      expect(session.version).toBe(10);
      expect(mockQuery.insert).not.toHaveBeenCalled();
    });

    it('should create new session if none exists', async () => {
      mockQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
      mockQuery.insert.mockReturnValue(mockQuery);
      mockQuery.single.mockResolvedValue({ 
        data: { 
            session_id: 'new-1', 
            phone: '123', 
            status: 'active',
            context: { variables: { global: { phoneNumber: '123', chatJid: '123', startedAt: 'now' } }, metadata: { flowId: 'f1', flowVersion: 1, entryPoint: 'trigger' } },
            last_activity: new Date().toISOString(),
            version: 0
        }, 
        error: null 
      });

      const session = await repository.getOrCreate('new-1', '123', 'f1');

      expect(session.id).toBe('new-1');
      expect(mockQuery.insert).toHaveBeenCalled();
    });
  });
});
