const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updateImages() {
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
        
        let updated = 0;

        for (const section of sections) {
            const items = section.hasMenuItem || [];
            
            for (const item of items) {
                const name = item.name;
                const image = item.image || '';
                
                if (image) {
                     const { error } = await supabase
                         .from('catalog_items')
                         .update({ image_url_1: image })
                         .eq('name', name);
                         
                     if (error) {
                         console.error(`❌ Error updating ${name}:`, error.message);
                     } else {
                         console.log(`✅ Updated image for: ${name}`);
                         updated++;
                     }
                }
            }
        }
        
        console.log(`\n🎉 Image update completed! Updated ${updated} items.`);
        process.exit(0);
        
    } catch (e) {
        console.error('Fatal error:', e);
        process.exit(1);
    }
}

updateImages();
