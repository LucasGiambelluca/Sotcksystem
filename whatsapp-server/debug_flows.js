
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function dumpFlows() {
    const { data: flows, error } = await supabase.from('bot_flows').select('*');
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log(`Found ${flows.length} flows.`);
    
    flows.forEach(f => {
        console.log(`\n🌊 Flow: ${f.name} (ID: ${f.id})`);
        console.log(`Nodes: ${f.nodes.length}, Edges: ${f.edges.length}`);
        
        console.log('--- Warning Checks ---');
        // Check for orphan nodes (not targeted by any edge, except start)
        // Check for dead ends (nodes with no outgoing edges)
        
        const nodeIds = new Set(f.nodes.map(n => n.id));
        const edges = f.edges;
        
        const hasIncoming = new Set();
        const hasOutgoing = new Set();
        
        edges.forEach(e => {
            hasIncoming.add(e.target);
            hasOutgoing.add(e.source);
        });
        
        f.nodes.forEach(n => {
            if (n.type !== 'input' && !hasIncoming.has(n.id)) {
                console.log(`⚠️ Orphan Node: ${n.id} (${n.type}) - No incoming edges.`);
            }
            if (!hasOutgoing.has(n.id)) {
                // Leaf node?
                console.log(`ℹ️ Leaf Node: ${n.id} (${n.type}) - No outgoing edges.`);
            }
        });
        
        // Print detailed structure for manual review
        console.log(JSON.stringify(f, null, 2));
    });
}

dumpFlows();
