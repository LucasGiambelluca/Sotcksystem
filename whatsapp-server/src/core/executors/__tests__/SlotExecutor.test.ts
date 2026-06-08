import { describe, it, expect } from 'vitest';
import { SlotExecutor } from '../SlotExecutor';

const slots = [
  { id: 's1', time_start: '12:00:00', time_end: '13:00:00' },
  { id: 's2', time_start: '13:00:00', time_end: '14:00:00' },
];

describe('SlotExecutor.handleInput', () => {
  it('maps a valid numeric pick to the slot id', async () => {
    const ex = new SlotExecutor();
    const res = await ex.handleInput!('2', {}, { phone: 'x', _temp_slots: slots } as any);
    expect(res.isValidInput).toBe(true);
    expect(res.updatedContext?.selected_slot_id).toBe('s2');
  });

  it('rejects out-of-range pick and keeps waiting', async () => {
    const ex = new SlotExecutor();
    const res = await ex.handleInput!('9', {}, { phone: 'x', _temp_slots: slots } as any);
    expect(res.isValidInput).toBe(false);
    expect(res.messages?.[0]).toMatch(/1 al 2/);
  });

  it('rejects non-numeric input', async () => {
    const ex = new SlotExecutor();
    const res = await ex.handleInput!('mañana', {}, { phone: 'x', _temp_slots: slots } as any);
    expect(res.isValidInput).toBe(false);
  });
});
