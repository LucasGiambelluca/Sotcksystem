// Script to optimize the "Tomar Pedido" flow with dedicated search nodes
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function optimizeFlow() {
    // 1. Fetch the existing flow
    const { data: flow, error } = await supabase
        .from('flows')
        .select('*')
        .eq('name', 'Tomar Pedido')
        .single();

    if (error || !flow) {
        console.error('Flow not found:', error);
        process.exit(1);
    }

    const ts = Date.now();
    const nid = (suffix) => `node_${ts}_${suffix}`;

    // We'll keep the structure but refine the search nodes
    // Current Search Node ID (from previous rebuild): search
    // Actually, since I used dynamic IDs in the previous script, I'll just regenerate the nodes/edges with the fixes.
    // I noticed in the previous run log: node_1775219920400_order_val, node_1775219920400_search, etc.
    
    const nodes = [
        ...flow.nodes.filter(n => n.type !== 'productSearchNode')
    ];

    const ovNode = nodes.find(n => n.type === 'orderValidatorNode');
    
    // Create 3 specific Search Nodes
    const searchBebidas = {
        id: nid('search_bebidas'),
        type: 'productSearchNode',
        position: { x: 1250, y: 400 },
        data: { query: 'bebidas', message: '🥤 Estas son nuestras bebidas disponibles:' }
    };
    const searchPostres = {
        id: nid('search_postres'),
        type: 'productSearchNode',
        position: { x: 1250, y: 600 },
        data: { query: 'postre', message: '🍰 Mirá que ricos postres tenemos:' }
    };
    const searchMas = {
        id: nid('search_mas'),
        type: 'productSearchNode',
        position: { x: 1250, y: 800 },
        data: { query: '', message: '🔍 Buscá lo que quieras sumar:' }
    };

    nodes.push(searchBebidas, searchPostres, searchMas);

    // Filter edges and rebuild connections to search nodes
    const edges = flow.edges.filter(e => !['add_drink', 'add_dessert', 'add_more'].includes(e.sourceHandle) && e.target !== flow.nodes.find(n => n.type === 'productSearchNode')?.id);

    // Connect OrderValidator to specific search nodes
    edges.push(
        { id: `e_ov_beb`, source: ovNode.id, sourceHandle: 'add_drink', target: searchBebidas.id, animated: true, style: { stroke: '#3b82f6' } },
        { id: `e_ov_pos`, source: ovNode.id, sourceHandle: 'add_dessert', target: searchPostres.id, animated: true, style: { stroke: '#8b5cf6' } },
        { id: `e_ov_mas`, source: ovNode.id, sourceHandle: 'add_more', target: searchMas.id, animated: true, style: { stroke: '#f59e0b' } }
    );

    // Loop back from all search nodes to OrderValidator
    edges.push(
        { id: `e_loop_beb`, source: searchBebidas.id, target: ovNode.id, animated: true, style: { stroke: '#f59e0b' }, label: '🔄 Loop', type: 'smoothstep' },
        { id: `e_loop_pos`, source: searchPostres.id, target: ovNode.id, animated: true, style: { stroke: '#f59e0b' }, label: '🔄 Loop', type: 'smoothstep' },
        { id: `e_loop_mas`, source: searchMas.id, target: ovNode.id, animated: true, style: { stroke: '#f59e0b' }, label: '🔄 Loop', type: 'smoothstep' }
    );

    // 3. Update the flow
    const { error: updateError } = await supabase
        .from('flows')
        .update({ nodes, edges })
        .eq('id', flow.id);

    if (updateError) {
        console.error('Update failed:', updateError);
        process.exit(1);
    }

    console.log('✅ Flow optimized with dedicated search nodes!');
    process.exit(0);
}

optimizeFlow();
