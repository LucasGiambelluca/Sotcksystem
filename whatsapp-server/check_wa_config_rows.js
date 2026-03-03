require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
    // Get ALL rows in whatsapp_config
    const { data, error } = await supabase
        .from('whatsapp_config')
        .select('id, is_active, business_hours, created_at');

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log(`Total rows in whatsapp_config: ${data.length}`);
    data.forEach((row, i) => {
        console.log(`\nRow ${i+1}:`);
        console.log(`  id: ${row.id}`);
        console.log(`  is_active: ${row.is_active}`);
        console.log(`  created_at: ${row.created_at}`);
        console.log(`  business_hours: ${JSON.stringify(row.business_hours)}`);
    });

    if (data.length > 1) {
        console.log('\n⚠️  MULTIPLE ROWS! The loadSettings uses .single() which may fail or pick wrong row.');
        console.log('👉 The force_update uses .single() which also may update a different row than the UI reads.');
    }

    if (data.length === 1) {
        console.log(`\nOnly 1 row (id=${data[0].id}), business_hours.isActive=${data[0].business_hours?.isActive}`);
        if (!data[0].business_hours?.isActive) {
            console.log('Updating to isActive=true NOW...');
            const { error: e } = await supabase
                .from('whatsapp_config')
                .update({ business_hours: { isActive: true, days: [1,2,3,4,5], startTime: '09:00', endTime: '12:00', timezone: 'America/Argentina/Buenos_Aires' } })
                .eq('id', data[0].id);
            if (e) console.error('Update failed:', e.message);
            else console.log('✅ Updated!');
        }
    }
}

check().catch(console.error);
