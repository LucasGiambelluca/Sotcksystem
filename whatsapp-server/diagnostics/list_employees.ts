import { supabase } from './config/database';

async function listEmployees() {
    const { data, error } = await supabase
        .from('employees')
        .select('*');
    
    if (error) {
        console.error('Error fetching employees:', error);
        return;
    }

    console.log('Employees found:', data.map(e => ({ name: e.name, role: e.role, is_active: e.is_active })));
}

listEmployees();
