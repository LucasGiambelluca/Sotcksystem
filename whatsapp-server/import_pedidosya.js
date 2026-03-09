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
        
        if (!data.hasMenu || !data.hasMenu.hasMenuSection) {
             console.log('No menu sections found in JSON.');
             return;
        }

        const sections = data.hasMenu.hasMenuSection;
        console.log(`🍔 Found ${sections.length} Categories!`);

        let totalItems = 0;
        
        for (const section of sections) {
            const categoryName = section.name;
            const items = section.hasMenuItem || [];
            
            console.log(`\n▶ Category: ${categoryName} (${items.length} items)`);
            
            for (const item of items) {
                const name = item.name;
                const desc = item.description || '';
                
                // Offers might be an array or a single object
                let price = 0;
                if (item.offers) {
                    if (Array.isArray(item.offers)) {
                         price = item.offers[0]?.price || 0;
                    } else {
                         price = item.offers.price || 0;
                    }
                }
                
                // Image might be directly on the item, unfortunately PedidosYa schema.org sometimes omits images.
                // We'll leave it empty if not provided.
                const image_url = item.image || '';

                console.log(`   - ${name} | $${price}`);
                
                const { error: catError } = await supabase
                    .from('catalog_items')
                    .upsert({
                        name: name,
                        description: desc,
                        price: parseFloat(price),
                        category: categoryName,
                        is_active: true
                    }, { onConflict: 'name' });
                    
                 if (catError) {
                      console.error(`     ❌ DB Error: ${catError.message}`);
                 } else {
                      totalItems++;
                 }
            }
        }
        
        console.log(`\n✅ Import successful! Inserted/Updated ${totalItems} items in catalog_items.`);
        
    } catch (e) {
        console.error('Fatal error:', e);
    }
}

importCatalog();
