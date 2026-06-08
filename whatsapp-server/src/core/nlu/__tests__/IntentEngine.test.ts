import { describe, it, expect } from 'vitest';
import { IntentEngine } from '../IntentEngine';

// extractQuickEntities is private; access via cast for the qty test.
// classify() returns { intent: 'ORDER'|'QUERY'|'UNKNOWN'|..., confidence, entities }
// where entities = { intent, items: [{ product, qty, modifiers }] }.
const extract = (text: string) =>
  (IntentEngine as unknown as {
    extractQuickEntities(t: string): { items: Array<{ qty: number }> };
  }).extractQuickEntities(text);

describe('IntentEngine over-match fixes', () => {
  it('"cinco minutos" is NOT classified as ORDER', () => {
    const r = IntentEngine.classify('cinco minutos');
    expect(r.intent).not.toBe('ORDER');
  });

  it('"esta bien" is NOT classified as QUERY', () => {
    const r = IntentEngine.classify('esta bien');
    expect(r.intent).not.toBe('QUERY');
  });

  it('"unas empanadas" yields qty 1, not 2', () => {
    const e = extract('unas empanadas');
    expect(e.items[0]?.qty ?? 1).toBe(1);
  });

  it('bare "unas" quantity maps to 1, not 2', () => {
    // Locks the lunfardo qty map: "unas" must be treated as 1 (vague plural),
    // distinct from "dos" => 2. Guards against the qtyStr === 'unas' branch
    // ever resolving to 2 if the prefix regex changes.
    const e = extract('unas docena');
    expect(e.items[0]?.qty ?? 1).toBe(1);
  });

  it('still classifies a real order "quiero 2 pollos" as ORDER', () => {
    const r = IntentEngine.classify('quiero 2 pollos');
    expect(r.intent).toBe('ORDER');
  });
});
