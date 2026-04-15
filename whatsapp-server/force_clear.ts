import { supabase } from './src/config/database';
import { redisPersistence } from './src/infrastructure/persistence/RedisPersistenceService';

async function clear() {
    console.log('Borrando todas las sesiones atascadas...');
    const { error } = await supabase
        .from('flow_executions')
        .update({ status: 'completed' })
        .in('status', ['active', 'waiting_input']);
    
    if (error) {
        console.error('Error supabase:', error);
    } else {
        console.log('Sesiones en DB completadas.');
        const phone = '176295539376186';
        await redisPersistence.deleteCheckpoint(phone);
        console.log('Checkpoint de Redis borrado.');
    }
    process.exit(0);
}

clear();
