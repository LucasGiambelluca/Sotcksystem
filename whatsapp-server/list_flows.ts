import { supabase } from './src/config/database';

async function listFlows() {
    console.log('Listando Flujos...');
    const { data, error } = await supabase.from('flows').select('id, name, trigger_word, is_active');
    console.log(data);
    process.exit(0);
}

listFlows();
