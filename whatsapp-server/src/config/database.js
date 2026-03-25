const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');

// --- Supabase Connection ---
const supabaseUrl = process.env.SUPABASE_URL;

// Helper to validate key
const isValidKey = (key) => key && key.length > 50 && key !== 'eyJ...';

const providedServiceKey = process.env.SUPABASE_SERVICE_KEY;
const isSbSecret = providedServiceKey && providedServiceKey.startsWith('sb_secret_');

let supabaseKey;
let keyType;

if (isValidKey(providedServiceKey)) {
    supabaseKey = providedServiceKey;
    keyType = 'SERVICE_ROLE (Admin)';
    console.log('✅ [DATABASE] Inicializado con SERVICE_ROLE (Permisos de Admin)');
} else {
    supabaseKey = process.env.SUPABASE_KEY;
    keyType = 'ANON (Public)';
    if (isSbSecret) {
        console.warn('❌ [DATABASE] ERROR CRÍTICO: "SUPABASE_SERVICE_KEY" en .env es una "DB Secret" (sb_secret_...) y NO la "service_role" key (JWT).');
        console.warn('El bot usará la clave ANON por defecto, lo que PROVOCARÁ FALLOS en RLS y Realtime.');
    } else {
        console.warn('⚠️ [DATABASE] Usando clave ANON. Se recomienda usar SERVICE_ROLE para operaciones de servidor.');
    }
}

const supabase = createClient(supabaseUrl, supabaseKey, {
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
    // Forzamos Long Polling si WebSockets falla por bloqueo del VPS
    db: { schema: 'public' },
    global: {
        headers: { 'x-application-name': 'whatsapp-bot' },
        fetch: (url, options) => {
            return fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
        }
    }
});

// --- Redis Connection ---
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redis.on('error', (err) => {
    console.error('❌ Redis Error:', err.message);
});

redis.on('connect', () => {
    console.log('✅ Redis Connected');
});

module.exports = {
    supabase,
    redis
};
