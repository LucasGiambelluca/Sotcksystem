const fs = require('fs');

require('dotenv').config({ path: './.env' });
require('dotenv').config({ path: '../client/.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const deleteUrl = `${SUPABASE_URL}/rest/v1/shipping_zones?select=*&name=ilike.*LORETO*`;

console.log('Sending GET request to:', deleteUrl);

fetch(deleteUrl, {
    method: 'GET',
    headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
    }
})
.then(res => res.json())
.then(data => {
    console.log('Deleted successfully. Data returned:', JSON.stringify(data, null, 2));
})
.catch(err => console.error('Error:', err));
