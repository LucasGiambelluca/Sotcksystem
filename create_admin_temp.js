const { createClient } = require('@supabase/supabase-js');

async function run() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key || key.includes('tu-service-role-key')) {
        console.log('SKIPPING: SUPABASE_SERVICE_KEY is default/missing. Cannot create admin automatically.');
        return;
    }

    const supabase = createClient(url, key);
    
    console.log('Attempting to create admin user...');
    const { data, error } = await supabase.auth.admin.createUser({
        email: 'elpollocomilon@admin.com',
        password: 'elpollocomilon2026',
        email_confirm: true,
        user_metadata: { role: 'admin' }
    });

    if (error) {
        console.error('Error creating user:', error.message);
    } else {
        console.log('SUCCESS: User created/verified.');
        console.log('Email: elpollocomilon@admin.com');
        console.log('Password: elpollocomilon2026');
    }
}

run();
