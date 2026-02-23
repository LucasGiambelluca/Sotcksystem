require('dotenv').config();
const { supabase } = require('./src/config/database');

async function checkFlows() {
    let { data: flows } = await supabase.from('flows').select('id, name, trigger_word').ilike('trigger_word', '%asesor%');
    console.log("Flows with 'asesor':", flows);
    
    let { data: nodes } = await supabase.from('flow_nodes').select('id, type, config').eq('type', 'handoverNode');
    console.log("Handover nodes:", nodes);
}
checkFlows();
