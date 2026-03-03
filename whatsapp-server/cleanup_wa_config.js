require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function cleanup() {
    console.log('🔍 Reading all whatsapp_config rows...');
    
    const { data: allRows, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .order('id', { ascending: true });

    if (error) { console.error('Error:', error.message); return; }
    
    console.log(`Found ${allRows.length} rows.`);
    if (allRows.length <= 1) { console.log('✅ Table is clean, nothing to do.'); return; }

    // Keep the LAST row (highest id) which likely has the user's settings
    const keepRow = allRows[allRows.length - 1];
    const deleteIds = allRows.slice(0, -1).map(r => r.id);

    console.log(`Keeping row id=${keepRow.id} (created: ${keepRow.created_at})`);
    console.log(`Deleting ${deleteIds.length} duplicate rows: [${deleteIds.join(', ')}]`);

    // Set consolidated business_hours on the kept row
    const bestBH = {
        isActive: true,
        days: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '20:00',
        timezone: 'America/Argentina/Buenos_Aires'
    };

    // Delete duplicates
    const { error: delErr } = await supabase
        .from('whatsapp_config')
        .delete()
        .in('id', deleteIds);

    if (delErr) {
        console.error('❌ Delete failed:', delErr.message);
        return;
    }

    console.log(`✅ Deleted ${deleteIds.length} duplicate rows.`);

    // Update kept row with sane default and isActive=true for testing
    const { error: updateErr } = await supabase
        .from('whatsapp_config')
        .update({ business_hours: bestBH })
        .eq('id', keepRow.id);

    if (updateErr) {
        console.error('❌ Update failed:', updateErr.message);
    } else {
        console.log(`✅ Updated row id=${keepRow.id} with business_hours:`, JSON.stringify(bestBH));
        console.log('\n📋 Now run the diagnostic again to confirm:');
        console.log('   node diagnose_business_hours.js');
    }
}

cleanup().catch(console.error);
