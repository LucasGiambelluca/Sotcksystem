// src/config/supabase.ts

import { createClient } from '@supabase/supabase-js';
import path from 'path';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ [SupabaseConfig] Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true
  },
  realtime: {
    timeout: 60000,
    params: {
      events_per_second: 20
    }
  }
});

console.log(`✅ [SupabaseConfig] Cliente inicializado (${supabaseKey.startsWith('eyJ') ? 'SERVICE_ROLE' : 'ANON'})`);
