require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function diagnose() {
    console.log('\n🔍 ========= BUSINESS HOURS DIAGNOSTIC =========\n');
    console.log(`🕐 Current server time: ${new Date().toISOString()}`);
    
    // Format in Buenos Aires timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires',
        weekday: 'long',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    console.log(`🇦🇷 Buenos Aires time: ${formatter.format(now)}`);
    
    const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires',
        weekday: 'short',
    });
    const weekdayStr = weekdayFormatter.format(now);
    const weekdayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    console.log(`📅 Current day index: ${weekdayMap[weekdayStr]} (${weekdayStr})\n`);

    // --- CHECK DB COLUMN ---
    console.log('1️⃣  Checking if business_hours column exists...');
    const { data: rawData, error: rawError } = await supabase
        .from('whatsapp_config')
        .select('*')
        .limit(1);

    if (rawError) {
        console.error('❌ Error reading whatsapp_config:', rawError.message);
        return;
    }

    if (!rawData || rawData.length === 0) {
        console.error('❌ whatsapp_config table is EMPTY. No row found.');
        return;
    }

    const row = rawData[0];
    console.log('✅ Row found. All columns:', Object.keys(row).join(', '));
    
    if (!('business_hours' in row)) {
        console.log('\n❌ PROBLEM: Column "business_hours" does NOT exist in the table.');
        console.log('👉 ACTION REQUIRED: Run this SQL in Supabase SQL Editor:');
        console.log('─'.repeat(70));
        console.log(`ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT \'{"isActive":false,"days":[1,2,3,4,5],"startTime":"09:00","endTime":"18:00","timezone":"America/Argentina/Buenos_Aires"}\'::jsonb;`);
        console.log('─'.repeat(70));
        console.log(`\n🌐 URL: https://supabase.com/dashboard/project/${process.env.SUPABASE_URL?.split('/')[2]?.split('.')[0]}/sql/new`);
        return;
    }

    // Column exists!
    const bh = row.business_hours;
    console.log('\n✅ Column "business_hours" EXISTS!');
    console.log('📋 Current value:', JSON.stringify(bh, null, 2));

    if (!bh) {
        console.log('\n⚠️  WARNING: business_hours is NULL. Will update with defaults...');
        const { error: updateErr } = await supabase
            .from('whatsapp_config')
            .update({ business_hours: { isActive: false, days: [1,2,3,4,5], startTime: '09:00', endTime: '18:00', timezone: 'America/Argentina/Buenos_Aires' } })
            .eq('id', row.id);
        if (updateErr) console.error('Update error:', updateErr.message);
        else console.log('✅ Updated with defaults.');
        return;
    }

    // --- EVALUATE HOURS ---
    console.log('\n2️⃣  Evaluating business hours...');
    const { isActive, days, startTime, endTime, timezone } = bh;
    console.log(`   isActive: ${isActive}`);
    console.log(`   days: [${days}] (0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat)`);
    console.log(`   startTime: ${startTime}`);
    console.log(`   endTime: ${endTime}`);
    console.log(`   timezone: ${timezone}`);

    if (!isActive) {
        console.log('\n⚠️  isActive=false → Always OPEN (no hour checking)');
        console.log('👉 To enable: Go to Configuración → WhatsApp Bot → Horarios de Atención → check the checkbox → Guardar');
        return;
    }

    // Compute
    const tzFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const parts = tzFormatter.formatToParts(now);
    const ws = parts.find(p => p.type === 'weekday')?.value;
    const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0');

    const currentDay = weekdayMap[ws] ?? now.getDay();
    const currentMinutes = h * 60 + m;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin   = eh * 60 + em;

    const isDayOpen  = days.includes(currentDay);
    const isTimeOpen = currentMinutes >= startMin && currentMinutes < endMin;
    const isOpen     = isDayOpen && isTimeOpen;

    console.log(`\n   Timezone time: ${ws} ${h}:${String(m).padStart(2,'0')} (${currentMinutes} min)`);
    console.log(`   Window: ${startTime}(${startMin}min) - ${endTime}(${endMin}min)`);
    console.log(`   isDayOpen: ${isDayOpen} | isTimeOpen: ${isTimeOpen}`);
    console.log(`\n🏪 RESULT: ${isOpen ? '✅ OPEN' : '❌ CLOSED'}`);

    if (!isDayOpen) {
        console.log(`\n⚠️  Today (${ws}, index ${currentDay}) is NOT in open days [${days}]`);
    }
    if (isDayOpen && !isTimeOpen) {
        console.log(`\n⚠️  Current time (${currentMinutes}min) is OUTSIDE the window ${startMin}-${endMin}min`);
    }

    // --- CHECK FLOW EDGES ---
    console.log('\n3️⃣  Checking saved flow for businessHoursNode edges...');
    const { data: flows } = await supabase
        .from('flows')
        .select('id, name, nodes, edges')
        .eq('is_active', true);
    
    if (!flows || flows.length === 0) {
        console.log('⚠️  No active flows found.');
    } else {
        for (const flow of flows) {
            const bhNode = (flow.nodes || []).find(n => n.type === 'businessHoursNode');
            if (!bhNode) continue;
            
            console.log(`\n   Flow: "${flow.name}" (${flow.id})`);
            console.log(`   businessHoursNode ID: ${bhNode.id}`);
            
            const edges = (flow.edges || []).filter(e => e.source === bhNode.id);
            console.log(`   Outgoing edges from node: ${edges.length}`);
            edges.forEach(e => {
                console.log(`     → handle="${e.sourceHandle}" → target="${e.target}"`);
            });

            if (edges.length === 0) {
                console.log('   ❌ NO EDGES! The businessHoursNode has no connections. Connect it in Bot Builder.');
            } else if (!edges.find(e => e.sourceHandle === 'true')) {
                console.log('   ❌ Missing edge for handle="true" (ABIERTO). Check Bot Builder connections.');
            } else if (!edges.find(e => e.sourceHandle === 'false')) {
                console.log('   ❌ Missing edge for handle="false" (CERRADO). Check Bot Builder connections.');
            } else {
                console.log('   ✅ Both true/false edges exist correctly.');
            }
        }
    }

    console.log('\n================================================\n');
}

diagnose().catch(console.error);
