import { supabase } from './src/config/database';

async function createBucket() {
    console.log('Verificando bucket chat-media...');
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === 'chat-media');
    
    if (!exists) {
        console.log('Creando bucket chat-media...');
        const { data, error } = await supabase.storage.createBucket('chat-media', {
            public: true,
            fileSizeLimit: 10485760
        });
        if (error) {
            console.error('Error creando bucket:', error);
        } else {
            console.log('Bucket creado con éxito.');
        }
    } else {
        console.log('El bucket ya existe.');
    }
    process.exit(0);
}

createBucket();
