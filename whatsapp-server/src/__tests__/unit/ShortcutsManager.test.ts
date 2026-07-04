import { describe, it, expect, beforeEach, vi } from 'vitest';

// Estado compartido del mock de Supabase (hoisted para que vi.mock lo vea)
const dbState = vi.hoisted(() => ({
  inserts: [] as { table: string; row: any }[],
  updates: [] as { table: string; values: any }[],
  selectResults: {} as Record<string, { data: any; error: any }>,
}));

vi.mock('../../config/database', () => {
  function makeQuery(table: string) {
    const q: any = {
      insert(row: any) {
        dbState.inserts.push({ table, row });
        return q;
      },
      update(values: any) {
        dbState.updates.push({ table, values });
        return q;
      },
      select: () => q,
      eq: () => q,
      in: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: () =>
        Promise.resolve(dbState.selectResults[table] ?? { data: null, error: null }),
      then(resolve: (v: any) => void) {
        resolve({ data: null, error: null });
      },
    };
    return q;
  }
  return { supabase: { from: makeQuery } };
});

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/ConfigurationService', () => ({
  ConfigurationService: {},
}));

import { ShortcutsManager } from '../../services/ShortcutsManager';

const PHONE = '5492915736341';

beforeEach(() => {
  dbState.inserts.length = 0;
  dbState.updates.length = 0;
  for (const k of Object.keys(dbState.selectResults)) delete dbState.selectResults[k];
});

describe('ShortcutsManager.handle — IDs de botones con underscore', () => {
  it('rate_5 devuelve mensaje de agradecimiento (no null)', async () => {
    const res = await ShortcutsManager.handle('rate_5', PHONE);
    expect(res).not.toBeNull();
    expect(res!.join(' ')).toMatch(/gracias/i);
  });

  it('rate_5 persiste la calificación con 5 estrellas', async () => {
    await ShortcutsManager.handle('rate_5', PHONE);
    const rating = dbState.inserts.find((i) => i.table === 'order_ratings');
    expect(rating).toBeDefined();
    expect(rating!.row.rating).toBe(5);
    expect(rating!.row.phone).toBe(PHONE);
  });

  it('rate_excellent persiste 5 estrellas', async () => {
    await ShortcutsManager.handle('rate_excellent', PHONE);
    const rating = dbState.inserts.find((i) => i.table === 'order_ratings');
    expect(rating).toBeDefined();
    expect(rating!.row.rating).toBe(5);
  });

  it('rate_2 persiste 2 estrellas y devuelve mensaje de feedback', async () => {
    const res = await ShortcutsManager.handle('rate_2', PHONE);
    expect(res).not.toBeNull();
    const rating = dbState.inserts.find((i) => i.table === 'order_ratings');
    expect(rating!.row.rating).toBe(2);
  });

  it('order_issue devuelve mensaje, registra el problema y notifica al panel', async () => {
    const res = await ShortcutsManager.handle('order_issue', PHONE);
    expect(res).not.toBeNull();
    expect(res!.join(' ')).toMatch(/inconveniente|problema/i);
    expect(dbState.inserts.some((i) => i.table === 'customer_issues')).toBe(true);
    expect(dbState.inserts.some((i) => i.table === 'notifications')).toBe(true);
  });

  it('view_order devuelve el estado del último pedido', async () => {
    dbState.selectResults['orders'] = {
      data: { order_number: '1234', status: 'DELIVERED', total: 500, delivery_address: 'Calle Falsa 123' },
      error: null,
    };
    const res = await ShortcutsManager.handle('view_order', PHONE);
    expect(res).not.toBeNull();
    expect(res!.join(' ')).toContain('#1234');
  });

  it('IDs envueltos en markdown (*rate_5*) siguen matcheando', async () => {
    const res = await ShortcutsManager.handle('*rate_5*', PHONE);
    expect(res).not.toBeNull();
    expect(res!.join(' ')).toMatch(/gracias/i);
  });
});

describe('ShortcutsManager.handle — soporte (handover)', () => {
  it('help pausa el bot y crea notificación interna para el equipo', async () => {
    const res = await ShortcutsManager.handle('help', PHONE);
    expect(res).not.toBeNull();
    // Pausa: update de flow_executions y whatsapp_conversations a HANDOVER
    expect(dbState.updates.some((u) => u.table === 'flow_executions' && u.values.status === 'HANDOVER')).toBe(true);
    expect(dbState.updates.some((u) => u.table === 'whatsapp_conversations' && u.values.status === 'HANDOVER')).toBe(true);
    // Nuevo: el equipo se entera
    const notif = dbState.inserts.find((i) => i.table === 'notifications');
    expect(notif).toBeDefined();
    expect(notif!.row.message).toContain(PHONE);
  });

  it('soporte (alias en español) también dispara handover', async () => {
    const res = await ShortcutsManager.handle('soporte', PHONE);
    expect(res).not.toBeNull();
    expect(dbState.inserts.some((i) => i.table === 'notifications')).toBe(true);
  });
});

describe('ShortcutsManager.handle — texto normal', () => {
  it('texto cualquiera devuelve null (pasa al FlowEngine)', async () => {
    const res = await ShortcutsManager.handle('hola buenas noches estan abiertos?', PHONE);
    expect(res).toBeNull();
  });
});
