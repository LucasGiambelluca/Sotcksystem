const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function setStock() {
    try {
        console.log('Update starting...');
        const { error } = await supabase.from('catalog_items').update({ stock: 20 }).neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) {
            console.error('Error updating stock', error);
        } else {
            console.log('Success! All products now have 20 units of stock.');
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

setStock();
