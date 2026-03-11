const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function fixTriggers() {
    // 1. Update 'Tomar Pedido (Bot)' to remove 'checkout_catalogo'
    const { error: error1 } = await supabase
        .from('flows')
        .update({ trigger_word: 'pedir' })
        .eq('id', 'a615026e-6b31-4799-b989-80809c6be2c6');
    
    if (error1) {
        console.error('Error updating Tomar Pedido flow:', error1);
    } else {
        console.log('Fixed Tomar Pedido flow trigger.');
    }

    // 2. Ensure 'Checkout Catálogo (Web)' has the correct trigger
    const { error: error2 } = await supabase
        .from('flows')
        .update({ trigger_word: 'checkout_catalogo' })
        .eq('id', 'bfe99e31-0fbc-4b54-9677-3aaaf263d811');
    
    if (error2) {
        console.error('Error updating Checkout Catálogo flow:', error2);
    } else {
        console.log('Ensured Checkout Catálogo flow trigger.');
    }
}

fixTriggers();
