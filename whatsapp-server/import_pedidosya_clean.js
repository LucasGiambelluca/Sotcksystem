const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function importCatalog() {
    try {
        const content = fs.readFileSync(path.join(__dirname, '..', 'json_tags.txt'), 'utf8');
        
        let jdsonStr = '';
        const blocks = content.split('=====');
        for (const block of blocks) {
            if (block.includes('"http://schema.org/"')) {
                jdsonStr = block.trim();
                break;
            }
        }
        
        if (!jdsonStr) {
            console.log('JSON content with schema.org not found in tags.');
            return;
        }

        const data = JSON.parse(jdsonStr);
        const sections = data.hasMenu.hasMenuSection || [];
        
        let inserted = 0;
        let skipped = 0;

        for (const section of sections) {
            const categoryName = section.name;
            const items = section.hasMenuItem || [];
            
            for (const item of items) {
                const name = item.name;
                const desc = item.description || '';
                
                let price = 0;
                if (item.offers) {
                    price = Array.isArray(item.offers) ? (item.offers[0]?.price || 0) : (item.offers.price || 0);
                }

                // Check if exists
                const { data: existing } = await supabase.from('catalog_items').select('id').eq('name', name).maybeSingle();
                
                if (!existing) {
                    const { error } = await supabase.from('catalog_items').insert({
                        name: name,
                        description: desc,
                        price: parseFloat(price),
                        category: categoryName,
                        is_active: true
                    });
                    
                    if (error) {
                        console.error(`❌ Error inserting ${name}:`, error.message);
                    } else {
                        console.log(`✅ Inserted: ${name} ($${price})`);
                        inserted++;
                    }
                } else {
                    console.log(`⏩ Skipped (already exists): ${name}`);
                    skipped++;
                }
            }
        }
        
        console.log(`\n🎉 Import completed! Inserted: ${inserted}. Skipped: ${skipped}.`);
        process.exit(0);
        
    } catch (e) {
        console.error('Fatal error:', e);
        process.exit(1);
    }
}

importCatalog();
