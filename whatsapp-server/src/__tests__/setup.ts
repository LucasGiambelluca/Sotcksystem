import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { supabase as defaultSupabase } from '../config/database';

// Para tests, podemos inyectar un cliente de Supabase apuntando a un entorno de test
// o simplemente limpiar la DB actual si el usuario lo prefiere.
// Por ahora, usamos el cliente por defecto pero preparamos limpieza.
export const testSupabase = defaultSupabase;

export const testRedis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  db: 1 // Usamos una DB diferente para no pisar producción
});

// Limpiar base antes de cada test
export async function cleanDatabase(): Promise<void> {
  // En Supabase/PostgREST no tenemos TRUNCATE directo vía cliente de forma sencilla sin RPC
  // Así que borramos los registros manualmente o vía RPC si existe.
  const tables = [
    'route_orders', 
    'order_items', 
    'order_status_history', 
    'orders', 
    'users', 
    'clients', 
    'delivery_slots', 
    'products', 
    'preparation_queues', 
    'flow_executions', 
    'flows'
  ];
  
  for (const table of tables) {
    try {
      // Usar un filtro que siempre sea verdadero para borrar todo
      const { error } = await testSupabase.from(table).delete().not('id', 'is', null);
      if (error && error.code !== 'PGRST116') { // Ignorar si ya está vacío o error de fila única
        console.warn(`[Setup] Warning deleting from ${table}:`, error.message);
      }
    } catch (err) {
      console.error(`[Setup] CRITICAL Error cleaning table ${table}:`, err);
    }
  }
}

export async function closeConnections(): Promise<void> {
  await testRedis.quit();
}
