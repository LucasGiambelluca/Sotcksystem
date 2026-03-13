import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// This script migrates categories, catalog items, and their associated images
// from one Supabase project to another.
// Run via: node migrate-catalog.js

// --- CONFIGURATION ---
// Source Project (Current/Dev)
const SOURCE_URL = process.env.SOURCE_SUPABASE_URL || 'YOUR_OLD_URL';
const SOURCE_KEY = process.env.SOURCE_SUPABASE_KEY || 'YOUR_OLD_SERVICE_ROLE_KEY';

// Destination Project (New VPS Production)
const DEST_URL = process.env.DEST_SUPABASE_URL || 'YOUR_NEW_URL';
const DEST_KEY = process.env.DEST_SUPABASE_KEY || 'YOUR_NEW_SERVICE_ROLE_KEY';

// Ensure you use SERVICE ROLE KEYS to bypass RLS policies!

const sourceClient = createClient(SOURCE_URL, SOURCE_KEY);
const destClient = createClient(DEST_URL, DEST_KEY);

const TEMP_DIR = path.join(process.cwd(), 'temp_images');

async function migrate() {
  console.log('🚀 Iniciando migración de catálogo...');

  if (SOURCE_URL === 'YOUR_OLD_URL' || DEST_URL === 'YOUR_NEW_URL') {
     console.error('❌ Error: Por favor edita este archivo (migrate-catalog.js) y pon tus URLs y CLAVES reales.');
     process.exit(1);
  }

  // 1. Create temp directory for images
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  // 2. Fetch Categories
  console.log('📦 Extrayendo categorías...');
  const { data: categories, error: catError } = await sourceClient.from('categories').select('*');
  if (catError) throw catError;
  console.log(`✅ ${categories.length} categorías encontradas.`);

  // 3. Fetch Products (catalog_items)
  console.log('🍔 Extrayendo productos del catálogo...');
  const { data: items, error: itemError } = await sourceClient.from('catalog_items').select('*');
  if (itemError) throw itemError;
  console.log(`✅ ${items.length} productos encontrados.`);

  // 3b. Fetch Bot Flows (flows)
  console.log('🤖 Extrayendo flujos del bot...');
  const { data: flows, error: flowError } = await sourceClient.from('flows').select('*');
  if (flowError) throw flowError;
  console.log(`✅ ${flows.length} flujos encontrados.`);

  // 4. Download Images from Source Bucket
  console.log('🖼️  Descargando imágenes originales...');
  const { data: files, error: fileError } = await sourceClient.storage.from('products').list();
  if (fileError) throw fileError;
  
  const validFiles = files.filter(f => f.name !== '.emptyFolderPlaceholder' && f.name !== '');
  console.log(`✅ ${validFiles.length} imágenes encontradas en el bucket 'products'.`);

  for (const file of validFiles) {
    console.log(`Descargando ${file.name}...`);
    const { data: blob, error: downloadError } = await sourceClient.storage.from('products').download(file.name);
    if (downloadError) {
       console.error(`Error descargando ${file.name}:`, downloadError);
       continue;
    }
    const buffer = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync(path.join(TEMP_DIR, file.name), buffer);
  }

  // --- DESTINATION UPLOAD ---
  console.log('\n====================================');
  console.log('🛰️  Comenzando subida al nuevo proyecto');
  console.log('====================================\n');

  // 5. Upload Images to Destination
  console.log('📤 Subiendo imágenes al nuevo bucket...');
  // Ensure bucket exists in destination
  const { data: buckets } = await destClient.storage.listBuckets();
  if (!buckets?.find(b => b.name === 'products')) {
     console.log('Creando bucket "products" en destino...');
     await destClient.storage.createBucket('products', { public: true });
  }

  for (const file of validFiles) {
     const filePath = path.join(TEMP_DIR, file.name);
     if (fs.existsSync(filePath)) {
         const fileBuffer = fs.readFileSync(filePath);
         console.log(`Subiendo ${file.name}...`);
         await destClient.storage.from('products').upload(file.name, fileBuffer, {
             upsert: true,
             contentType: file.metadata?.mimetype || 'image/jpeg'
         });
     }
  }

  // 6. Insert Categories
  console.log('📤 Insertando categorías en destino...');
  for (const cat of categories) {
     // Check if exists
     const { data: exists } = await destClient.from('categories').select('id').eq('id', cat.id).single();
     if (!exists) {
         await destClient.from('categories').insert(cat);
     }
  }

  // 7. Insert Catalog Items
  console.log('📤 Insertando productos en destino...');
  for (const item of items) {
      const { data: exists } = await destClient.from('catalog_items').select('id').eq('id', item.id).single();
      if (!exists) {
         // Transform images paths if they are absolute URLs
         let images = item.images || [];
         if (images.length > 0) {
             // If images are stored as absolute URLs from the old domain, we replace the domain.
             // If they are just filenames, they stay the same.
             images = images.map((img: string) => {
                 if (img.includes(SOURCE_URL)) {
                    return img.replace(SOURCE_URL, DEST_URL);
                 }
                 return img;
             });
             item.images = images;
         }
         await destClient.from('catalog_items').insert(item);
      }
  }

  // 8. Cleanup
  console.log('🧹 Limpiando archivos temporales...');
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });

  console.log('\n🎉 ¡Migración del Catálogo completada con éxito!');
}

migrate().catch(console.error);
