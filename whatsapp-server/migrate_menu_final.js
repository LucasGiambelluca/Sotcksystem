const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptd3p3ZGdtanJseHR3Y3d4aGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAyNTg4MSwiZXhwIjoyMDg5NjAxODgxfQ.gYQ5UXEKqWePvP5JPVGWnQ0jQKlqLpXFYDR77oSSq_c';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrate() {
    try {
        console.log('Reading extracted_menu.json...');
        const menuData = JSON.parse(fs.readFileSync('extracted_menu.json', 'utf8'));
        
        const sections = menuData.hasMenu.hasMenuSection;
        const itemsToInsert = [];
        let sortOrder = 1;

        for (const section of sections) {
            const categoryName = section.name;
            console.log(`Processing category: ${categoryName}`);
            
            for (const item of section.hasMenuItem) {
                itemsToInsert.push({
                    name: item.name,
                    description: item.description || '',
                    price: item.offers.price,
                    image_url: item.image || null,
                    category: categoryName,
                    is_active: true,
                    stock: 999,
                    production_stock: 999,
                    min_stock: 0,
                    sort_order: sortOrder++
                });
            }
        }

        console.log(`Prepared ${itemsToInsert.length} items to insert.`);

        // 1. Delete existing items
        console.log('Deleting existing catalog_items...');
        const { error: deleteError } = await supabase
            .from('catalog_items')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (deleteError) {
            console.error('Error deleting items:', deleteError);
            return;
        }

        // 2. Insert new items in chunks to be safe
        const chunkSize = 50;
        for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
            const chunk = itemsToInsert.slice(i, i + chunkSize);
            console.log(`Inserting chunk ${i / chunkSize + 1}...`);
            const { error: insertError } = await supabase
                .from('catalog_items')
                .insert(chunk);

            if (insertError) {
                console.error(`Error inserting chunk ${i / chunkSize + 1}:`, insertError);
                return;
            }
        }

        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrate();
