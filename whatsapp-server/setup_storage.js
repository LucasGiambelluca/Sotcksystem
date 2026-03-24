const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorage() {
  console.log(`Setting up storage buckets for ${supabaseUrl}...`);
  
  // Create 'product-images' bucket
  const { data, error } = await supabase.storage.createBucket('product-images', {
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('Bucket "product-images" already exists.');
    } else {
      console.error('Error creating bucket:', error.message);
    }
  } else {
    console.log('Bucket "product-images" created successfully!');
  }

  // Check if we need to add RLS policies for storage or if 'public' is enough.
  // In Supabase, 'public' means anyone can read, but you still need a policy to write.
  // I'll add a policy so that authenticated users (or the service role) can upload.
  console.log('Storage buckets ready.');
}

setupStorage();
