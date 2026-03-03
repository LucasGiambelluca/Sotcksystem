require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL; // e.g. https://xxx.supabase.co
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env');
    process.exit(1);
}

// Extract project ref from URL: https://xxx.supabase.co
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];

const SQL = `ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"isActive":false,"days":[1,2,3,4,5],"startTime":"09:00","endTime":"18:00","timezone":"America/Argentina/Buenos_Aires"}'::jsonb;`;

console.log('\n📋 Copy and run this SQL in your Supabase SQL Editor:');
console.log('─'.repeat(70));
console.log(SQL);
console.log('─'.repeat(70));
console.log('\n🌐 SQL Editor URL: https://supabase.com/dashboard/project/' + projectRef + '/sql/new\n');

// Now verify the column state by trying to read it
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAndUpdate() {
    // Try reading business_hours
    const { data, error } = await supabase
        .from('whatsapp_config')
        .select('id, business_hours')
        .single();

    if (error) {
        if (error.message.includes('business_hours')) {
            console.log('❌ Column business_hours does NOT exist yet.');
            console.log('👆 Please run the SQL above in the Supabase SQL Editor.');
        } else {
            console.error('❌ Other error:', error.message);
        }
        return;
    }

    console.log('✅ Column business_hours EXISTS!');
    console.log('Current value:', JSON.stringify(data.business_hours, null, 2));

    // If it's null, set the default
    if (!data.business_hours) {
        console.log('Updating with default values...');
        const { error: updateErr } = await supabase
            .from('whatsapp_config')
            .update({
                business_hours: {
                    isActive: false,
                    days: [1, 2, 3, 4, 5],
                    startTime: '09:00',
                    endTime: '18:00',
                    timezone: 'America/Argentina/Buenos_Aires'
                }
            })
            .eq('id', data.id);

        if (updateErr) {
            console.error('Update error:', updateErr.message);
        } else {
            console.log('✅ Default business_hours set.');
        }
    }
}

checkAndUpdate();
