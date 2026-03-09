const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function extractImages() {
    try {
        console.log('Loading HTML file...');
        const htmlPath = path.join(__dirname, '..', 'client', 'public', 'El Pollo Comilon a Domicilio ¡Pide Delivery! _ PedidosYa.html');
        const content = fs.readFileSync(htmlPath, 'utf8');

        console.log('Fetching catalog items from DB...');
        const { data: catalogItems, error } = await supabase.from('catalog_items').select('id, name');
        if (error) throw error;
        
        console.log(`Found ${catalogItems.length} items in DB. Mapping images from HTML...`);

        let updatedCount = 0;

        for (const item of catalogItems) {
            const name = item.name;
            
            // Look for the name in the HTML, then find the closest image before it.
            // A product card in PedidosYa usually has an image followed by the name inside a div/h3/p.
            
            // Using a simple RegExp to find the name and grabbing the preceding 1000 characters
            // Since string.indexOf is very fast:
            const nameIdx = content.indexOf(name);
            if (nameIdx !== -1) {
                 const block = content.substring(Math.max(0, nameIdx - 500), nameIdx + 50);
                 // Now find the LAST image URL in this block
                 const imgMatches = [...block.matchAll(/<img[^>]*src=["']([^"']+\.(png|webp|jpe?g)[^"']*)["']/gi)];
                 
                 // If not found in img, check source srcset
                 let imgUrl = null;
                 if (imgMatches.length > 0) {
                     imgUrl = imgMatches[imgMatches.length - 1][1];
                 } else {
                     const srcMatches = [...block.matchAll(/<source[^>]*srcset=["']([^"']+\.(png|webp|jpe?g)[^"']*)["']/gi)];
                     if(srcMatches.length > 0) {
                         imgUrl = srcMatches[srcMatches.length - 1][1].split(' ')[0]; // Take the first URL from srcset
                     }
                 }
                 
                 if (imgUrl && !imgUrl.includes('placeholder')) {
                      // Fix lazy-loaded image sources
                      if (imgUrl.includes('data:image')) {
                          // Ignore inline placeholders
                          continue;
                      }
                      
                      console.log(`[FOUND image] ${name} -> ${imgUrl.substring(0, 50)}...`);
                      
                      // Update DB
                      await supabase.from('catalog_items').update({ image_url: imgUrl }).eq('id', item.id);
                      updatedCount++;
                 } else {
                      console.log(`[NO IMAGE] ${name}`);
                 }
            } else {
               console.log(`[NOT FOUND IN HTML] ${name}`);
            }
        }
        
        console.log(`\n🎉 Image extraction complete. Updated ${updatedCount} items.`);
        process.exit(0);
    } catch (e) {
        console.error('Fatal error:', e);
        process.exit(1);
    }
}

extractImages();
