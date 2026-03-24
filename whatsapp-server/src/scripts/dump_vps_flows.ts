import { supabase } from '../config/database';

async function dumpFlows() {
    console.log('--- PRODUCTION FLOWS DUMP ---');
    const { data: flows, error } = await supabase.from('flows').select('id, name, slug');
    
    if (error) {
        console.error('Error fetching flows:', error);
        return;
    }

    if (!flows || flows.length === 0) {
        console.log('No flows found in the database.');
        return;
    }

    console.table(flows);
    console.log('----------------------------');
}

dumpFlows();
