
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('--- DIAGNÓSTICO DE RELACIONES ---');
  
  // 1. Check public_branding columns
  console.log('Columns in public_branding:');
  const { data: sample, error: errS } = await supabase.from('public_branding').select('*').limit(1);
  if (sample && sample.length > 0) {
    console.log(Object.keys(sample[0]));
  } else {
    console.log('No data found or table empty/not existing');
  }

  // 2. Try common relationship names
  const relations = ['catalog_categories', 'catalog_category', 'category', 'categories'];
  for (const rel of relations) {
    const { data, error } = await supabase
      .from('catalog_items')
      .select(`id, ${rel}(id, name)`)
      .limit(1);
    
    if (error) {
      console.log(`Relation '${rel}' FAILED:`, error.message);
    } else {
      console.log(`Relation '${rel}' WORKED!`);
    }
  }
}

diagnose();
