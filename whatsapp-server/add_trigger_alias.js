const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function addAlias() {
    // Find the 'pedir' flow
    const { data: flows } = await supabase
        .from('flows')
        .select('id, trigger_word')
        .eq('trigger_word', 'pedir');

    if (flows && flows.length > 0) {
        const flow = flows[0];
        // En Supabase, si trigger_word es solo texto, podemos cambiarlo a una lista si la DB lo soporta,
        // o simplemente crear un nuevo flujo que sea un link, o cambiar el trigger a algo que incluya ambos.
        
        // Pero espera, el FlowEngine usa .or(`trigger_word.ilike.${cleanText},trigger_word.ilike.%${cleanText}%`)
        // Si cambio el trigger_word a "pedir, checkout_catalogo", el ilike %checkout_catalogo% lo encontrará.
        
        const newTrigger = "pedir, checkout_catalogo";
        const { error } = await supabase
            .from('flows')
            .update({ trigger_word: newTrigger })
            .eq('id', flow.id);

        if (error) {
            console.error('Error updating trigger:', error);
        } else {
            console.log(`Updated flow ${flow.id} trigger to: ${newTrigger}`);
        }
    } else {
        console.log('Flow "pedir" not found');
    }
}

addAlias();
