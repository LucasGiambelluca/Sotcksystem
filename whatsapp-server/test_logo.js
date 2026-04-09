
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Jimp = require('jimp');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testLogo() {
    console.log('--- TEST LOGO PROCESSING ---');
    try {
        const { data: config } = await supabase.from('printer_config').select('*').limit(1).maybeSingle();
        const url = config?.logo_url || 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co/storage/v1/object/public/system/logos/eldelirio.png'; // Fallback if no config
        
        console.log(`Using URL: ${url}`);
        
        const image = await Jimp.read(url);
        console.log('✅ Jimp successfully read the image');
        
        image.resize(200, Jimp.AUTO);
        image.greyscale().contrast(0.2);
        
        console.log('✅ Image processed (resize/greyscale)');
        
        // Manual 1-bit conversion test
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        console.log(`Dimensions: ${width}x${height}`);
        
        console.log('--- TEST SUCCESS ---');
    } catch (err) {
        console.error('❌ ERROR TESTING LOGO:', err);
    }
}

testLogo();
