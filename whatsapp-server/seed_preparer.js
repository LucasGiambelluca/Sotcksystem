const { supabase } = require('./src/config/database');

async function seedPreparer() {
    console.log('Creating test preparer...');
    try {
        const { data, error } = await supabase
            .from('users')
            .upsert({
                id: '00000000-0000-0000-0000-000000000001', // ID fijo para pruebas
                name: 'Cocinero de Prueba',
                role: 'PREPARER',
                is_active: true,
                current_status: 'ONLINE'
            }, { onConflict: 'id' });

        if (error) throw error;
        console.log('✅ Test preparer created/updated.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error creating preparer:', err);
        process.exit(1);
    }
}

seedPreparer();
