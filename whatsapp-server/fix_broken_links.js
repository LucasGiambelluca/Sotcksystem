
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixLinks() {
    console.log('--- Fixing Broken Flow Links ---');

    const { data: flows } = await supabase.from('flows').select('*');
    if (!flows) return;

    const nameToId = {};
    flows.forEach(f => {
        nameToId[f.name] = f.id;
    });

    console.log('Flow Name to ID Map:', nameToId);

    for (const flow of flows) {
        let changed = false;
        const newNodes = flow.nodes.map(node => {
            if (node.type === 'flowLinkNode' && node.data?.flowId) {
                const currentTargetId = node.data.flowId;
                // Check if target ID exists
                const targetExists = flows.some(f => f.id === currentTargetId);
                if (!targetExists) {
                    console.log(`Found broken link in flow "${flow.name}" node "${node.id}". Target: ${currentTargetId}`);
                    // Strategy: Try to find by name if we can, or use "Tomar Pedido" as default if it looks like it
                    // In this specific case, we know "d7f26..." was "Tomar Pedido"
                    if (currentTargetId === 'd7f26b46-2ac6-48bc-ad4e-6547dba77e20') {
                        node.data.flowId = nameToId['Tomar Pedido'];
                        console.log(`Updated to new "Tomar Pedido" ID: ${node.data.flowId}`);
                        changed = true;
                    }
                }
            }
            return node;
        });

        if (changed) {
            await supabase.from('flows').update({ nodes: newNodes }).eq('id', flow.id);
            console.log(`✅ Flow "${flow.name}" links fixed.`);
        }
    }
}

fixLinks();
