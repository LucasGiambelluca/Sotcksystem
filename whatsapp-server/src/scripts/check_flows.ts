import 'dotenv/config';
import { supabase } from '../config/database';

async function checkFlow(flowId?: string) {
    if (flowId && flowId !== 'all') {
        const { data: flow, error } = await supabase
            .from('flows')
            .select('*')
            .eq('id', flowId)
            .single();

        if (error) {
            console.error('Error fetching flow:', error);
            return;
        }

        console.log(`Flow: ${flow.name} (${flow.id})`);
        console.log(`Trigger: ${flow.trigger_word}`);
        console.log(`Active: ${flow.is_active}`);
        console.log('Nodes:');
        (flow.nodes || []).forEach((node: any) => {
            console.log(`- [${node.id}] ${node.type}: ${node.data?.label || node.data?.text || ''}`);
        });
        
        console.log('Edges:');
        (flow.edges || []).forEach((edge: any) => {
            console.log(`- ${edge.source} -> ${edge.target} (Handle: ${edge.sourceHandle || 'default'})`);
        });
    } else {
        const { data: flows, error } = await supabase
            .from('flows')
            .select('id, name, trigger_word, is_active');

        if (error) {
            console.error('Error fetching flows:', error);
            return;
        }

        console.log('All Flows:');
        flows.forEach(flow => {
            console.log(`- ID: ${flow.id} | Name: ${flow.name} | Trigger: ${flow.trigger_word} | Active: ${flow.is_active}`);
        });
    }
}

const args = process.argv.slice(2);
checkFlow(args[0]);
