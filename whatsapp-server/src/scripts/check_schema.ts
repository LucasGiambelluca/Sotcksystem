import { supabase } from '../config/database';

async function checkStockMovements() {
    console.log('Checking stock_movements table...');
    const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching stock_movements:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]));
    } else {
        console.log('No stock_movements found, but table exists.');
    }
}

checkStockMovements();
