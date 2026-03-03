require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function migrate() {
    console.log('Running product images migration...');

    // Check if columns already exist
    const { data, error } = await supabase
        .from('products')
        .select('image_url_1, image_url_2')
        .limit(1);

    if (!error) {
        console.log('✅ Columns image_url_1 and image_url_2 already exist in products table!');
        return;
    }

    if (error.code === 'PGRST204' || error.message?.includes('image_url_1')) {
        console.log('❌ Columns do not exist. Please run this SQL in Supabase SQL Editor:');
        console.log('─'.repeat(70));
        console.log('ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url_1 TEXT;');
        console.log('ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url_2 TEXT;');
        console.log('─'.repeat(70));
        const projectId = process.env.SUPABASE_URL?.split('//')[1]?.split('.')[0];
        console.log(`\n🌐 URL: https://supabase.com/dashboard/project/${projectId}/sql/new`);
    } else {
        console.error('Unknown error checking columns:', error);
    }
}

migrate().catch(console.error);
