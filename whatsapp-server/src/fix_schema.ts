
import { supabase } from './config/database';

async function fixSchema() {
    console.log('--- FIXING SCHEMA FOR ASSIGNMENTS ---');
    
    // 1. Drop the old constraint if it exists
    const sql1 = `
        ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_assigned_to_fkey;
    `;
    
    // 2. Add the new constraint to employees table
    const sql2 = `
        ALTER TABLE orders ADD CONSTRAINT orders_assigned_to_fkey 
        FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL;
    `;

    // Try to run these via a custom RPC if available, or just log them for the user to run.
    // However, I can also try to use the 'rpc' method if 'exec_sql' exists.
    
    console.log('SQL to run:');
    console.log(sql1);
    console.log(sql2);

    // If I can't run RAW SQL, I'll at least verify if the constraint exists using a query.
    const { data: constraints, error } = await supabase.from('information_schema.table_constraints' as any)
        .select('*' as any)
        .eq('table_name' as any, 'orders')
        .eq('constraint_name' as any, 'orders_assigned_to_fkey');
    
    if (error) {
        console.error('Could not check constraints:', error.message);
    } else {
        console.log('Current constraint info:', constraints);
    }
}

fixSchema().catch(console.error);
