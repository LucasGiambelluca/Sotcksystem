require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function forceUpdate() {
    console.log('Forcing isActive=true and times for testing...');
    
    const { data: row } = await supabase
        .from('whatsapp_config')
        .select('id, business_hours')
        .limit(1)
        .single();

    if (!row) {
        console.error('No row found!');
        return;
    }

    console.log('Current value:', JSON.stringify(row.business_hours));

    // Set isActive true and hours that should detect "CLOSED" now (it's 15:35 BsAs, Thu)
    // Set: Mon-Fri, 09:00-12:00 → should be CLOSED now
    const newBH = {
        isActive: true,
        days: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '12:00',  // Closed after 12:00
        timezone: 'America/Argentina/Buenos_Aires'
    };

    const { error } = await supabase
        .from('whatsapp_config')
        .update({ business_hours: newBH })
        .eq('id', row.id);

    if (error) {
        console.error('Update error:', error.message);
    } else {
        console.log('✅ Updated! New value:', JSON.stringify(newBH));
        console.log('\nNow test the bot - it should be CLOSED since current time is 15:35 and window is 09:00-12:00');
        console.log('Restart the server and send "hola" to test.');
    }
}

forceUpdate().catch(console.error);
