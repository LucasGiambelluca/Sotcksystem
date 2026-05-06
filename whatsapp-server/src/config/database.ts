import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

// --- Supabase Connection ---
const supabaseUrl = process.env.SUPABASE_URL || '';

const isValidKey = (key: string | undefined): boolean =>
    !!key && key.length > 50 && key !== 'eyJ...';

const providedServiceKey = process.env.SUPABASE_SERVICE_KEY;
const isSbSecret = providedServiceKey?.startsWith('sb_secret_');

let supabaseKey: string;

if (isValidKey(providedServiceKey)) {
    supabaseKey = providedServiceKey!;
    console.log('✅ [DATABASE] Inicializado con SERVICE_ROLE (Permisos de Admin)');
} else {
    supabaseKey = process.env.SUPABASE_KEY || '';
    if (isSbSecret) {
        console.warn('❌ [DATABASE] ERROR CRÍTICO: "SUPABASE_SERVICE_KEY" en .env es una "DB Secret" (sb_secret_...) y NO la "service_role" key (JWT).');
        console.warn('El bot usará la clave ANON por defecto, lo que PROVOCARÁ FALLOS en RLS y Realtime.');
    } else {
        console.warn('⚠️ [DATABASE] Usando clave ANON. Se recomienda usar SERVICE_ROLE para operaciones de servidor.');
    }
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: true
    },
    realtime: {
        timeout: 60000,
        params: {
            events_per_second: 20
        }
    },
    db: { schema: 'public' },
    global: {
        headers: { 'x-application-name': 'whatsapp-bot' },
        fetch: (url: RequestInfo | URL, options?: RequestInit) => {
            return fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
        }
    }
});

// --- Redis Connection ---
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    enableOfflineQueue: false,
    retryStrategy(times: number): number | null {
        if (times > 3) return null;
        return Math.min(times * 50, 2000);
    }
});

redis.on('error', (err: Error) => {
    console.error('❌ Redis Error:', err.message);
});

redis.on('connect', () => {
    console.log('✅ Redis Connected');
});

export { supabase, redis };
