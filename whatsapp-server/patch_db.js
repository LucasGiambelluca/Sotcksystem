const fs = require('fs');

require('dotenv').config({ path: './.env' });
require('dotenv').config({ path: '../client/.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const updateUrl = `${SUPABASE_URL}/rest/v1/shipping_zones?name=ilike.*LORETO*`;

console.log('Sending PATCH request to:', updateUrl);

fetch(updateUrl, {
    method: 'PATCH',
    headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    },
    body: JSON.stringify({ allow_delivery: true })
})
.then(res => res.json())
.then(data => {
    console.log('Updated successfully. Data returned:', JSON.stringify(data, null, 2));
})
.catch(err => console.error('Error:', err));
