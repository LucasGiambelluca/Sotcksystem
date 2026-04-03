// Script to rebuild the "Tomar Pedido" flow with proper edges and loop
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function rebuildFlow() {
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

    console.log('Found flow:', flow.id);
    console.log('Current nodes:', flow.nodes?.length || 0);
    console.log('Current edges:', flow.edges?.length || 0);

    // Print current node types and IDs
    (flow.nodes || []).forEach(n => {
        console.log(`  Node: ${n.id} (${n.type}) - ${n.data?.label || n.data?.question || n.data?.message?.substring(0, 40) || '...'}`);
    });
    
    console.log('\nCurrent edges:');
    (flow.edges || []).forEach(e => {
        console.log(`  ${e.source} --[${e.sourceHandle || 'default'}]--> ${e.target}`);
    });

    // 2. Build the ideal "Tomar Pedido" flow
    // This flow should be:
    // START -> Poll("Delivery/Retiro") 
    //   -> [Delivery] -> Question("Dirección") -> LocationValidator
    //       -> [true] -> SendCatalog -> OrderValidator
    //       -> [false] -> Message("No llegamos") -> END
    //   -> [Retiro] -> SendCatalog -> OrderValidator
    // OrderValidator:
    //   -> [confirmed] -> CreateOrder
    //   -> [add_drink/add_dessert/add_more] -> ProductSearch -> (LOOP back to OrderValidator)
    //   -> [cancel] -> ClearCart -> Message("Cancelado")

    const ts = Date.now();
    const nid = (suffix) => `node_${ts}_${suffix}`;

    const nodes = [
        // START
        {
            id: 'start',
            type: 'input',
            position: { x: 50, y: 300 },
            data: { label: 'Inicio' }
        },
        // POLL: Delivery o Retiro
        {
            id: nid('poll_tipo'),
            type: 'pollNode',
            position: { x: 280, y: 250 },
            data: {
                question: '¿Cómo querés recibir tu pedido?',
                options: ['Delivery', 'Retiro en Local'],
                variable: 'tipo_pedido'
            }
        },
        // MESSAGE: Pedir dirección (Delivery)
        {
            id: nid('msg_dir'),
            type: 'messageNode',
            position: { x: 560, y: 100 },
            data: {
                message: '📍 Bien, antes que nada veamos si llegamos hasta tu dirección.'
            }
        },
        // QUESTION: Capturar dirección
        {
            id: nid('q_dir'),
            type: 'questionNode',
            position: { x: 830, y: 100 },
            data: {
                question: '¿A qué dirección enviamos el pedido?',
                variable: 'direccion'
            }
        },
        // LOCATION VALIDATOR
        {
            id: nid('loc_val'),
            type: 'locationValidatorNode',
            position: { x: 1100, y: 100 },
            data: { label: 'Validar Ubicación' }
        },
        // MESSAGE: Fuera de zona
        {
            id: nid('msg_fuera'),
            type: 'messageNode',
            position: { x: 1370, y: 0 },
            data: {
                message: '😔 Lo sentimos, no llegamos a esa dirección. Podés optar por retiro en local o probar otra dirección.'
            }
        },
        // SEND CATALOG (Delivery path)
        {
            id: nid('catalog_del'),
            type: 'sendCatalogNode',
            position: { x: 1370, y: 200 },
            data: {
                message: '🛒 ¡Genial! Acá tenés nuestro menú. Elegí lo que quieras y mandanos el pedido:',
                label: 'Catálogo (Delivery)'
            }
        },
        // SEND CATALOG (Retiro path) — same node type, different instance
        {
            id: nid('catalog_ret'),
            type: 'sendCatalogNode',
            position: { x: 560, y: 420 },
            data: {
                message: '🛒 ¡Perfecto! Acá tenés nuestro menú para retiro en local:',
                label: 'Catálogo (Retiro)'
            }
        },
        // ORDER VALIDATOR (The central hub with loop)
        {
            id: nid('order_val'),
            type: 'orderValidatorNode',
            position: { x: 900, y: 350 },
            data: {
                message: '🛒 *Confirmá tu pedido:*',
                label: 'Validar Pedido'
            }
        },
        // PRODUCT SEARCH (Buscador IA - for upselling loop)
        {
            id: nid('search'),
            type: 'productSearchNode',
            position: { x: 1250, y: 500 },
            data: {
                query: '',
                message: '🔍 Buscá lo que quieras sumar:'
            }
        },
        // CREATE ORDER (confirmed path)
        {
            id: nid('create_order'),
            type: 'createOrderNode',
            position: { x: 1250, y: 300 },
            data: {
                label: 'Crear Pedido',
                message: '✅ ¡Pedido confirmado! Te avisaremos cuando esté listo.'
            }
        },
        // CLEAR CART (cancel path)
        {
            id: nid('clear_cart'),
            type: 'clearCartNode',
            position: { x: 600, y: 600 },
            data: {
                message: '🧹 Tu pedido ha sido cancelado y el carrito vaciado.'
            }
        },
    ];

    const edges = [
        // START -> Poll
        { id: `e_start_poll`, source: 'start', target: nid('poll_tipo'), animated: true, style: { stroke: '#6366f1' } },
        
        // Poll -> Delivery path (option-0)
        { id: `e_poll_del`, source: nid('poll_tipo'), sourceHandle: 'option-0', target: nid('msg_dir'), animated: true, style: { stroke: '#3b82f6' } },
        
        // Poll -> Retiro path (option-1)
        { id: `e_poll_ret`, source: nid('poll_tipo'), sourceHandle: 'option-1', target: nid('catalog_ret'), animated: true, style: { stroke: '#10b981' } },

        // Delivery: Message -> Question
        { id: `e_msg_q`, source: nid('msg_dir'), target: nid('q_dir'), animated: true, style: { stroke: '#3b82f6' } },
        
        // Question -> LocationValidator
        { id: `e_q_loc`, source: nid('q_dir'), target: nid('loc_val'), animated: true, style: { stroke: '#3b82f6' } },
        
        // LocationValidator -> [true] Catalog (Delivery)
        { id: `e_loc_ok`, source: nid('loc_val'), sourceHandle: 'true', target: nid('catalog_del'), animated: true, style: { stroke: '#10b981' } },
        
        // LocationValidator -> [false] Out of zone message
        { id: `e_loc_fail`, source: nid('loc_val'), sourceHandle: 'false', target: nid('msg_fuera'), animated: true, style: { stroke: '#ef4444' } },
        
        // Catalog (Delivery) -> OrderValidator
        { id: `e_catdel_ov`, source: nid('catalog_del'), target: nid('order_val'), animated: true, style: { stroke: '#6366f1' } },
        
        // Catalog (Retiro) -> OrderValidator
        { id: `e_catret_ov`, source: nid('catalog_ret'), target: nid('order_val'), animated: true, style: { stroke: '#10b981' } },
        
        // OrderValidator -> [confirmed] -> CreateOrder
        { id: `e_ov_confirm`, source: nid('order_val'), sourceHandle: 'confirmed', target: nid('create_order'), animated: true, style: { stroke: '#10b981' } },
        
        // OrderValidator -> [add_drink] -> ProductSearch
        { id: `e_ov_drink`, source: nid('order_val'), sourceHandle: 'add_drink', target: nid('search'), animated: true, style: { stroke: '#3b82f6' } },
        
        // OrderValidator -> [add_dessert] -> ProductSearch
        { id: `e_ov_dessert`, source: nid('order_val'), sourceHandle: 'add_dessert', target: nid('search'), animated: true, style: { stroke: '#8b5cf6' } },
        
        // OrderValidator -> [add_more] -> ProductSearch
        { id: `e_ov_more`, source: nid('order_val'), sourceHandle: 'add_more', target: nid('search'), animated: true, style: { stroke: '#f59e0b' } },
        
        // OrderValidator -> [cancel] -> ClearCart
        { id: `e_ov_cancel`, source: nid('order_val'), sourceHandle: 'cancel', target: nid('clear_cart'), animated: true, style: { stroke: '#ef4444' } },
        
        // *** THE LOOP *** ProductSearch -> back to OrderValidator
        { id: `e_search_loop`, source: nid('search'), target: nid('order_val'), animated: true, style: { stroke: '#f59e0b', strokeWidth: 3 }, label: '🔄 Loop', type: 'smoothstep' },
    ];

    // 3. Update the flow in the database
    const { error: updateError } = await supabase
        .from('flows')
        .update({ nodes, edges })
        .eq('id', flow.id);

    if (updateError) {
        console.error('Update failed:', updateError);
        process.exit(1);
    }

    console.log('\n✅ Flow "Tomar Pedido" rebuilt successfully!');
    console.log(`   Nodes: ${nodes.length}`);
    console.log(`   Edges: ${edges.length}`);
    console.log(`   Loop: ProductSearch -> OrderValidator (edge: e_search_loop)`);
    console.log('\n🔄 Refresh the Bot Builder to see the changes.');
    
    process.exit(0);
}

rebuildFlow().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
