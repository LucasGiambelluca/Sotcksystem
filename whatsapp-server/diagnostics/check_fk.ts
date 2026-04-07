
import { supabase } from './config/database';

async function checkFK() {
    const { data: constraints, error } = await supabase.rpc('get_table_constraints', { t_name: 'orders' });
    if (error) {
        // Fallback: raw SQL via a known way or just check information_schema
        const { data: infSchema, error: infError } = await supabase
            .from('information_schema.key_column_usage' as any)
            .select('*' as any)
            .eq('table_name' as any, 'orders')
            .eq('column_name' as any, 'assigned_to');
        
        if (infError) {
            console.error('Error checking FK:', infError.message);
        } else {
            console.log('FK Info for assigned_to:', infSchema);
        }
    } else {
        console.log('Constraints for orders:', constraints);
    }

    // Also check if assigned_at exists
    const { data: cols, error: colErr } = await supabase.rpc('get_column_names', { table_name: 'orders' });
    if (!colErr) {
        console.log('Orders columns:', cols);
    }
}

checkFK().catch(console.error);
