const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptd3p3ZGdtanJseHR3Y3d4aGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAyNTg4MSwiZXhwIjoyMDg5NjAxODgxfQ.gYQ5UXEKqWePvP5JPVGWnQ0jQKlqLpXFYDR77oSSq_c';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function cleanAndMigrate() {
    try {
        console.log('Starting full cleanup and migration...');
        
        // 1. Delete order-related data first (cascade issues)
        console.log('Cleaning up orders and related data...');
        await supabase.from('order_notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // 2. Delete catalog items
        console.log('Deleting existing catalog_items...');
        await supabase.from('catalog_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // 3. Read and parse new menu
        console.log('Reading extracted_menu.json...');
        const menuData = JSON.parse(fs.readFileSync('extracted_menu.json', 'utf8'));
        const sections = menuData.hasMenu.hasMenuSection;
        const itemsToInsert = [];
        let sortOrder = 1;

        for (const section of sections) {
            const categoryName = section.name;
            for (const item of section.hasMenuItem) {
                itemsToInsert.push({
                    name: item.name,
                    description: item.description || '',
                    price: item.offers.price,
                    image_url_1: item.image || null,
                    category: categoryName,
                    is_active: true,
                    stock: 999,
                    sort_order: sortOrder++
                });
            }
        }

        console.log(`Inserting ${itemsToInsert.length} new items...`);
        // Inserting in chunks to avoid any payload limits
        const chunkSize = 20;
        for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
            const chunk = itemsToInsert.slice(i, i + chunkSize);
            const { error: insertError } = await supabase
                .from('catalog_items')
                .insert(chunk);

            if (insertError) {
                console.error(`Error inserting chunk ${i/chunkSize}:`, insertError);
                return;
            }
        }

        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Cleanup and migration failed:', err);
    }
}

cleanAndMigrate();
