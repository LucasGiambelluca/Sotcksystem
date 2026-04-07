
import { supabase } from './config/database';

async function checkOrdersEnum() {
    console.log('--- CHECKING ORDERS STATUS ENUM ---');
    try {
        // Query pg_enum to get the values for the 'order_status' type or similar
        const { data, error } = await supabase.rpc('get_enum_values', { type_name: 'order_status' });
        
        if (error) {
            console.log('RPC get_enum_values failed, trying manual query...');
            const { data: raw, error: rawErr } = await supabase.from('orders').select('status').limit(10);
            if (rawErr) throw rawErr;
            const statuses = [...new Set(raw.map(r => r.status))];
            console.log('Current statuses in orders table:', statuses);
        } else {
            console.log('Enum values for order_status:', data);
        }
    } catch (e: any) {
        console.error('Error:', e.message);
    }
}

checkOrdersEnum();
