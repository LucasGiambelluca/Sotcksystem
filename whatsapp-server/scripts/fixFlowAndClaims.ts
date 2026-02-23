import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixFlowAndCreateTable() {
    console.log('=== FIX 1: Repair broken nodes in Bienvenida flow ===\n');

    const flowId = '07500313-a416-46ea-8144-b95db28a8dbe';
    const { data: flow, error } = await supabase
        .from('flows')
        .select('*')
        .eq('id', flowId)
        .single();

    if (error || !flow) {
        console.error('Error fetching flow:', error);
        return;
    }

    const nodes = flow.nodes || [];
    let fixed = 0;

    // Fix dndnode_7: add missing variable
    const node7 = nodes.find((n: any) => n.id === 'dndnode_7');
    if (node7 && !node7.data?.variable) {
        node7.data = { ...node7.data, variable: 'respuesta' };
        console.log('  ✅ Fixed dndnode_7: added variable="respuesta"');
        fixed++;
    }

    // Save updated nodes
    if (fixed > 0) {
        const { error: updateErr } = await supabase
            .from('flows')
            .update({ nodes })
            .eq('id', flowId);

        if (updateErr) {
            console.error('  ❌ Error saving flow:', updateErr);
        } else {
            console.log(`  ✅ Flow saved with ${fixed} fix(es)`);
        }
    } else {
        console.log('  ℹ️ No fixes needed for nodes');
    }

    // === FIX 2: Create claims table ===
    console.log('\n=== FIX 2: Create claims table ===\n');

    // Check if the table exists first
    const { data: testData, error: testErr } = await supabase
        .from('claims')
        .select('id')
        .limit(1);

    if (testErr && testErr.code === 'PGRST205') {
        console.log('  Table does not exist. Creating via SQL...');
        
        // Use supabase RPC to run raw SQL
        const createSQL = `
            CREATE TABLE IF NOT EXISTS public.claims (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
                type TEXT NOT NULL DEFAULT 'general',
                status TEXT NOT NULL DEFAULT 'open',
                description TEXT,
                priority TEXT NOT NULL DEFAULT 'medium',
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            -- Enable RLS
            ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

            -- Create policy for authenticated access
            CREATE POLICY "Allow all for authenticated" ON public.claims
                FOR ALL USING (true) WITH CHECK (true);

            -- Create index
            CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);
            CREATE INDEX IF NOT EXISTS idx_claims_client ON public.claims(client_id);
        `;

        const { error: sqlErr } = await supabase.rpc('exec_sql', { sql: createSQL });
        if (sqlErr) {
            console.log('  ⚠️ RPC exec_sql not available. Please run this SQL manually in your Supabase SQL Editor:');
            console.log('  ---');
            console.log(createSQL);
            console.log('  ---');
        } else {
            console.log('  ✅ Claims table created!');
        }
    } else if (!testErr) {
        console.log('  ✅ Claims table already exists');
    } else {
        console.error('  ❌ Unexpected error:', testErr);
    }

    // Verify final state
    console.log('\n=== VERIFICATION ===\n');
    const { data: verifyFlow } = await supabase.from('flows').select('nodes').eq('id', flowId).single();
    const verifyNodes = verifyFlow?.nodes || [];
    const condNodes = verifyNodes.filter((n: any) => n.type === 'conditionNode');
    const linkNodes = verifyNodes.filter((n: any) => n.type === 'flowLinkNode');

    console.log('Condition Nodes:');
    for (const cn of condNodes) {
        console.log(`  ${cn.id}: variable="${cn.data?.variable || 'MISSING!'}" expected="${cn.data?.expectedValue}" ${cn.data?.variable ? '✅' : '⚠️'}`);
    }
    console.log('FlowLink Nodes:');
    for (const fl of linkNodes) {
        console.log(`  ${fl.id}: flowId="${fl.data?.flowId || 'MISSING!'}" ${fl.data?.flowId ? '✅' : '⚠️'}`);
    }

    console.log('\n✨ Done!');
}

fixFlowAndCreateTable();
