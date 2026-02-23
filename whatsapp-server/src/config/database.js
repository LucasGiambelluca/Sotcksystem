require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');

// --- Supabase Connection ---
const supabaseUrl = process.env.SUPABASE_URL;

// Helper to validate key
const isValidKey = (key) => key && key.length > 50 && key !== 'eyJ...';

let supabaseKey;
let keyType;

if (isValidKey(process.env.SUPABASE_SERVICE_KEY)) {
    supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    keyType = 'SERVICE_ROLE (Admin)';
} else {
    supabaseKey = process.env.SUPABASE_KEY;
    keyType = 'ANON (Public)';
}

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase Config Error: URL or Key is missing!');
    console.error('URL:', supabaseUrl);
    console.error('Key (length):', supabaseKey ? supabaseKey.length : 0);
} else {
    console.log(`✅ Supabase initialized with ${keyType} key.`);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
