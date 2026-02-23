import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugFlow() {
    const flowId = '07500313-a416-46ea-8144-b95db28a8dbe';
    console.log(`\n=== INSPECTING FLOW ${flowId} ===\n`);

    const { data: flow, error } = await supabase
        .from('flows')
        .select('*')
        .eq('id', flowId)
        .single();

    if (error || !flow) {
        console.error('Error:', error);
        return;
    }

    console.log('Flow Name:', flow.name);
    console.log('Trigger:', flow.trigger_word);

    const nodes = flow.nodes || [];
    const edges = flow.edges || [];

    console.log(`\nNodes (${nodes.length}):`);
    nodes.forEach((node: any) => {
        console.log(`  [${node.id}] type=${node.type}`);
        console.log(`    Data:`, JSON.stringify(node.data, null, 2).split('\n').map((l: string, i: number) => i === 0 ? l : '          ' + l).join('\n'));
    });

    console.log(`\nEdges (${edges.length}):`);
    edges.forEach((edge: any) => {
        console.log(`  ${edge.source} (${edge.sourceHandle || 'default'}) --> ${edge.target}`);
    });

    // Check for broken condition nodes (missing variable)
    console.log('\n=== CONDITION NODE HEALTH CHECK ===');
    const conditionNodes = nodes.filter((n: any) => n.type === 'conditionNode');
    for (const cn of conditionNodes) {
        const hasVariable = !!cn.data?.variable;
        const hasExpectedValue = cn.data?.expectedValue !== undefined;
        console.log(`  ${cn.id}: variable="${cn.data?.variable || 'MISSING!'}" expectedValue="${cn.data?.expectedValue || 'MISSING!'}" ${!hasVariable ? '⚠️ BROKEN' : '✅ OK'}`);
    }

    // Check FlowLink nodes
    console.log('\n=== FLOWLINK NODE CHECK ===');
    const flowLinkNodes = nodes.filter((n: any) => n.type === 'flowLinkNode');
    for (const fl of flowLinkNodes) {
        console.log(`  ${fl.id}: targetFlowId="${fl.data?.targetFlowId || 'MISSING!'}" targetFlowName="${fl.data?.targetFlowName || '?'}"`);
        
        // Check which edges point TO this node
        const incomingEdges = edges.filter((e: any) => e.target === fl.id);
        console.log(`    Incoming edges: ${incomingEdges.map((e: any) => `${e.source}(${e.sourceHandle || 'default'})`).join(', ')}`);
    }
}

debugFlow();
