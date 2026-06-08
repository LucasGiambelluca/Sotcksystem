import { describe, it, expect } from 'vitest';
import { Session } from '../Session';

describe('Session transient field persistence', () => {
  const baseInput = () => ({
    session_id: 'x',
    phone: '123',
    current_node_id: 'n1',
    status: 'waiting_input' as const,
    context: {
      variables: { global: { phoneNumber: '123', chatJid: '123', startedAt: '2026-06-08T00:00:00.000Z' }, shared: {} },
      interactionLog: [],
      metadata: { flowId: 'f1', flowVersion: 1, entryPoint: 'trigger' as const },
    },
    last_activity: '2026-06-08T00:00:00.000Z',
    version: 0,
  });

  it('round-trips existing fields through toJSON/fromJSON', () => {
    const s: any = Session.fromJSON(baseInput());
    const restored: any = Session.fromJSON(s.toJSON());
    expect(restored.id).toBe('x');
    expect(restored.userPhone).toBe('123');
    expect(restored.currentNodeId).toBe('n1');
    expect(restored.status).toBe('waiting_input');
    expect(restored.getContext().metadata.flowId).toBe('f1');
  });

  it('round-trips _pendingMessages through toJSON/fromJSON', () => {
    const s: any = Session.fromJSON(baseInput());
    s._pendingMessages = ['re-prompt'];
    const json = s.toJSON();
    const restored: any = Session.fromJSON(json);
    expect(restored._pendingMessages).toEqual(['re-prompt']);
  });

  it('round-trips _exitToAI and _aiResult through toJSON/fromJSON', () => {
    const s: any = Session.fromJSON(baseInput());
    s._exitToAI = true;
    s._aiResult = { reply: 'handled by AI', confidence: 0.9 };
    const json = s.toJSON();
    const restored: any = Session.fromJSON(json);
    expect(restored._exitToAI).toBe(true);
    expect(restored._aiResult).toEqual({ reply: 'handled by AI', confidence: 0.9 });
  });

  it('does NOT add top-level transient keys to toJSON (DB column safety)', () => {
    const s: any = Session.fromJSON(baseInput());
    s._pendingMessages = ['x'];
    s._exitToAI = true;
    s._aiResult = { foo: 'bar' };
    const json = s.toJSON();
    expect(json._pendingMessages).toBeUndefined();
    expect(json._exitToAI).toBeUndefined();
    expect(json._aiResult).toBeUndefined();
    // Only these top-level columns may be emitted
    const allowed = new Set([
      'session_id', 'phone', 'current_node_id', 'status', 'context',
      'last_activity', 'version', 'flow_id', 'expires_at', 'global_variables',
    ]);
    for (const key of Object.keys(json)) {
      expect(allowed.has(key)).toBe(true);
    }
  });

  it('omits _transient when no transient fields are set', () => {
    const s: any = Session.fromJSON(baseInput());
    const json = s.toJSON();
    expect(json.context.metadata._transient).toBeUndefined();
  });
});
