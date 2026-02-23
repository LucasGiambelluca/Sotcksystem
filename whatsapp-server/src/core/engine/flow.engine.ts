import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../../config/database'; // Adjust path as needed
import { FlowDefinition, FlowNode, FlowEdge, FlowExecution, ExecutionResult } from '../../flows/types/flow.types';

// Executors
import { NodeExecutor } from '../../core/executors/types';
import { MessageExecutor } from '../../core/executors/MessageExecutor';
import { QuestionExecutor } from '../../core/executors/QuestionExecutor';
import { PollExecutor } from '../../core/executors/PollExecutor';
import { CatalogExecutor } from '../../core/executors/CatalogExecutor';
import { SlotExecutor } from '../../core/executors/SlotExecutor';
import { CreateOrderExecutor } from '../../core/executors/CreateOrderExecutor';
import { ConditionExecutor } from '../../core/executors/ConditionExecutor';
import { FlowLinkExecutor } from '../../core/executors/FlowLinkExecutor';
import { MediaUploadExecutor } from '../../core/executors/MediaUploadExecutor';
import { DocumentExecutor } from '../../core/executors/DocumentExecutor';
import { ThreadManagerExecutor } from '../../core/executors/ThreadManagerExecutor';
import { OrderSummaryExecutor } from '../../core/executors/OrderSummaryExecutor';
import { TimerExecutor } from '../../core/executors/TimerExecutor';
import { StartNodeExecutor } from '../../core/executors/StartNodeExecutor';
import { ReportExecutor } from '../../core/executors/ReportExecutor';
import { StockCheckExecutor } from '../../core/executors/StockCheckExecutor';
import { AddToCartExecutor } from '../../core/executors/AddToCartExecutor';

import { HandoverExecutor } from '../../core/executors/HandoverExecutor';

// Registry
const nodeExecutors: Record<string, NodeExecutor> = {
    'messageNode': new MessageExecutor(),
    'questionNode': new QuestionExecutor(),
    'pollNode': new PollExecutor(),
    'catalogNode': new CatalogExecutor(),
    'slotNode': new SlotExecutor(),
    'createOrderNode': new CreateOrderExecutor(),
    'orderSummaryNode': new OrderSummaryExecutor(),
    'conditionNode': new ConditionExecutor(),
    'flowLinkNode': new FlowLinkExecutor(),
    'mediaUploadNode': new MediaUploadExecutor(),
    'documentNode': new DocumentExecutor(),
    'threadNode': new ThreadManagerExecutor(),
    'timerNode': new TimerExecutor(),
    'reportNode': new ReportExecutor(),
    'stockCheckNode': new StockCheckExecutor(),
    'addToCartNode': new AddToCartExecutor(),
    'handoverNode': new HandoverExecutor(),
    
    // Start / Input nodes
    'input': new StartNodeExecutor(),
    'start': new StartNodeExecutor(),
    
    // Legacy support
    'send_message': new MessageExecutor(),
    'wait_input': new QuestionExecutor() 
};

export class FlowEngine {
    private db: any;
    private orderService: any;
    private slotService: any;

    constructor(dbClient?: any, orderServiceInstance?: any, slotServiceInstance?: any) {
        this.db = dbClient || supabase;
        this.orderService = orderServiceInstance;
        this.slotService = slotServiceInstance;
    }

    async processMessage(phone: string, messageText: string, context: any = {}): Promise<any> {
        const startTime = Date.now();
        console.log(`[FlowEngine] 📩 New message from ${phone}: "${messageText}"`);

        // 0. GLOBAL INTERRUPTS (Reset logic)
        // If the user says "hola", "menu", "cancelar", "inicio", we should probably restart.
        const globalTriggers = ['hola', 'menu', 'menú', 'cancelar', 'inicio', 'salir'];
        const isGlobalTrigger = globalTriggers.includes(messageText.trim().toLowerCase());

        let execution = null;

        if (isGlobalTrigger) {
            console.log(`[FlowEngine] 🛑 Global trigger detected: "${messageText}". Cancelling active flows.`);
            // Cancel any active execution for this user
            await this.db.from('flow_executions')
                .update({ status: 'cancelled', completed_at: new Date() })
                .eq('phone', phone)
                .eq('status', 'active');
            
            // Execution remains null, so we will search for a new flow below.
        } else {
            // 1. Get Active Execution
            execution = await this.getExecution(phone);
        }

        let resultMessages: string[] = [];
        let flowId = 'NONE';

        // 2. If no execution, check triggers
        if (!execution) {
            const flow = await this.findFlowByTrigger(messageText);
            console.log(`[FlowEngine] 🔍 Found flow:`, flow ? flow.id : 'NULL');

            if (!flow) {
                console.error(`[FlowEngine] ❌ No flow found for trigger: "${messageText}"`);
                const fallbackMessage = '❌ No entendí. Escribe "hola" o "menú" para ver las opciones.';
                
                console.log(`
┌─────────────────────────────────────┐
│  MESSAGE PROCESSED (NO FLOW)        │
│  Phone: ${phone}                    │
│  Input: "${messageText.substring(0,30)}"│
│  Flow: NONE                         │
│  Time: ${Date.now() - startTime}ms  │
└─────────────────────────────────────┘
`);
                return {
                    currentStateDefinition: {
                        message_template: fallbackMessage
                    }
                };
            }
            
            flowId = flow.id;
            console.log(`[FlowEngine] Starting flow "${flow.name}" (${flow.id})`);
            execution = await this.startExecution(flow, phone, context);
            
            // Execute the FIRST node immediately
            resultMessages = await this.executeStep(execution, null);
        } else {
            // 3. If we have an execution, we are processing an INPUT for the current waiting node
            flowId = execution.flow_id;
            resultMessages = await this.handleInputAndNext(execution, messageText);
        }

        console.log(`
┌─────────────────────────────────────┐
│  MESSAGE PROCESSED                  │
│  Phone: ${phone}                    │
│  Input: "${messageText.substring(0,30)}"│
│  Flow: ${flowId}                    │
│  Responses: ${resultMessages.length}     │
│  Time: ${Date.now() - startTime}ms  │
└─────────────────────────────────────┘
`);

        return {
            currentStateDefinition: {
                // Return the raw array so the router/sender can handle objects (Polls)
                message_template: resultMessages 
            }
        };
    }

    // Adapter for ConversationRouter
    async startFlow(flowTrigger: string, context: any) {
        // Map trigger/intent back to a flow trigger word if possible, or just search
        // For now, let's assume flowTrigger IS the trigger word (e.g. 'order', 'support')
        // Or we might need a mapping if 'ORDER_FLOW' -> 'pedir'
        let actualTrigger = flowTrigger;
        if (flowTrigger === 'order') actualTrigger = 'pedir'; 
        if (flowTrigger === 'support') actualTrigger = 'ayuda'; 
        if (flowTrigger === 'main_menu') actualTrigger = 'hola';

        const phone = context.userId || context.phone;
        return this.processMessage(phone, actualTrigger, context);
    }

    // Adapter for ConversationRouter
    async continueFlow(flowId: string, message: any, context: any) {
        const phone = context.userId || context.phone;
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        return this.processMessage(phone, text, context);
    }

    private async getExecution(phone: string): Promise<FlowExecution | null> {
        const { data, error } = await this.db
            .from('flow_executions')
            .select('*')
            .eq('phone', phone)
            .eq('status', 'active')
            .single();

        if (error || !data) return null;
        return data as FlowExecution;
    }

    private async findFlowByTrigger(text: string): Promise<FlowDefinition | null> {
        // Safe check for DB
        if (!this.db) return null;
        
        console.log(`[FlowEngine] 🔍 Searching flow for: "${text}"`);

        // Basic normalization
        const cleanText = text.trim().toLowerCase();

        const { data, error } = await this.db
            .from('flows')
            .select('*')
            .eq('is_active', true)
            // .ilike('trigger_word', text.trim()) // Using simple ilike might need exact match or %
             .or(`trigger_word.ilike.${cleanText},trigger_word.ilike.%${cleanText}%`)
            .limit(1); // take the first match

        console.log(`[FlowEngine] 📊 Supabase result:`, {
            found: data?.length || 0,
            firstId: data?.[0]?.id,
            error: error
        });

        if (error || !data || data.length === 0) return null;
        return data[0] as FlowDefinition; 
    }

    private async startExecution(flow: FlowDefinition, phone: string, context: any = {}): Promise<FlowExecution> {
        // Find start node (Node with no incoming edges or just the first one)
        // For React Flow, usually we look for type 'input' or 'start'
        // But the user's screenshot shows "Inicio" is a standard node.
        // Let's rely on finding a node that is NOT a target of any edge, OR specifically type 'input'
        
        const targetIds = new Set((flow.edges || []).map((e: any) => e.target));
        const startNode = (flow.nodes || []).find((n: any) => n.type === 'input') || 
                          (flow.nodes || []).find((n: any) => !targetIds.has(n.id)) || 
                          flow.nodes[0];

        if (!startNode) throw new Error("Flow has no nodes");

        const executionData = {
            flow_id: flow.id,
            phone,
            current_node_id: startNode.id,
            status: 'active',
            context: context,
            started_at: new Date().toISOString()
        };

        const { data, error } = await this.db
            .from('flow_executions')
            .insert(executionData)
            .select()
            .single();

        if (error) {
            console.error("Error starting execution:", error);
            throw error;
        }
        return data as FlowExecution;
    }

    private async executeStep(execution: FlowExecution, input: string | null): Promise<string[]> {
        // Fetch Flow to get nodes
        const { data: flow, error } = await this.db
            .from('flows')
            .select('*')
            .eq('id', execution.flow_id)
            .single();

        if (!flow) {
            console.error(`[FlowEngine] Flow ${execution.flow_id} not found for execution ${execution.id}`);
            await this.db.from('flow_executions').update({ status: 'error', completed_at: new Date() }).eq('id', execution.id);
            return ["⚠️ Error: La definición del flujo ha cambiado o no se encuentra disponible."];
        }

        const currentNode = (flow.nodes || []).find((n: any) => n.id === execution.current_node_id);
        if (!currentNode) return ["Error: Node not found"];

        console.log(`[FlowEngine] Executing Node: ${currentNode.type} (${currentNode.id})`);

        // Special Case: Flow Link Node
        if (currentNode.type === 'flowLinkNode') {
             const targetFlowId = currentNode.data.flowId;
             console.log(`[FlowEngine] Switching to Flow ID: ${targetFlowId}`);
             
             // 1. Mark current as completed (optional, or just switch)
             await this.db.from('flow_executions').update({ status: 'completed', completed_at: new Date() }).eq('id', execution.id);

             // 2. Start new execution
             const { data: newFlow } = await this.db.from('flows').select('*').eq('id', targetFlowId).single();
             if (newFlow) {
                  const newExec = await this.startExecution(newFlow, execution.phone, execution.context);
                 return this.executeStep(newExec, null);
             } else {
                 return ["⚠️ Error: Flujo destino no encontrado."];
             }
        }
        
        // Execute Action
        const executor = nodeExecutors[currentNode.type];
        if (!executor) {
            console.error(`[FlowEngine] No executor found for type: ${currentNode.type}`);
            return ["⚠️ Error: Tipo de nodo no soportado."];
        }

        console.log(`[FlowEngine] Delegating to Executor: ${currentNode.type}`);
        
        // Execute logic on the specific class
        const execContext = { ...execution.context, phone: execution.phone };
        const result = await executor.execute(currentNode.data, execContext, this);
        const outputMessages = result.messages || [];

        // Si el handler devolvió info temporal (como slots), la guardamos en el contexto
        if (result.updatedContext) {
            execution.context = { ...execution.context, ...result.updatedContext };
            await this.db.from('flow_executions').update({ context: execution.context }).eq('id', execution.id);
        }

        // If it's a condition result, we don't send messages, we just move based on the result
        if (result.hasOwnProperty('conditionResult')) {
             return this.advanceToNextNode(execution, flow, outputMessages, String(result.conditionResult));
        }

        // If the node waits for input, STOP here and update generic state if needed
        if (result.wait_for_input) {
            console.log(`[FlowEngine] Node ${currentNode.id} waiting for input.`);
            return outputMessages; 
        }

        // If NOT waiting for input, move to NEXT node immediately (auto-advance)
        // e.g. "MessageNode" just sends and moves on.
        return this.advanceToNextNode(execution, flow, outputMessages);
    }

    private async handleInputAndNext(execution: FlowExecution, input: string): Promise<string[]> {
         // Fetch Flow
         const { data: flow } = await this.db
            .from('flows')
            .select('*')
            .eq('id', execution.flow_id)
            .single();
        
        if (!flow) {
            console.error(`[FlowEngine] Flow ${execution.flow_id} not found during input handling.`);
            await this.db.from('flow_executions').update({ status: 'error', completed_at: new Date() }).eq('id', execution.id);
            return ["⚠️ Tu sesión ha expirado o el flujo ya no existe. Por favor, escribe 'hola' para empezar de nuevo."];
        }

        const currentNode = (flow.nodes || []).find((n: any) => n.id === execution.current_node_id);

        if (currentNode) {
             // 1. Lógica Especial por Tipo de Nodo
             if (currentNode.type === 'catalogNode') {
                 console.log(`[FlowEngine] Parsing order items for: ${input}`);
                 const items = await this.orderService.parseOrderText(input);
                 execution.context = { ...execution.context, order_items: items };
             } else if (currentNode.type === 'pollNode') {
                 // Resolve numbered input to option text (e.g. "1" → "Envío")
                 const options = currentNode.data.options || ['Sí', 'No'];
                 const num = parseInt(input.trim());
                 let resolved = input; // fallback to raw text
                 if (!isNaN(num) && num >= 1 && num <= options.length) {
                     resolved = options[num - 1];
                 } else {
                     // Try to match by text (case-insensitive)
                     const match = options.find((o: string) => o.toLowerCase() === input.trim().toLowerCase());
                     if (match) resolved = match;
                 }
                 console.log(`[FlowEngine] Poll resolved: "${input}" → "${resolved}"`);
                 const varName = currentNode.data.variable || 'poll_response';
                 execution.context = { ...execution.context, [varName]: resolved };
             } else if (currentNode.type === 'slotNode') {
                 const selection = parseInt(input.trim());
                 const tempSlots = execution.context._temp_slots || [];
                 if (!isNaN(selection) && selection > 0 && selection <= tempSlots.length) {
                     execution.context = { 
                         ...execution.context, 
                         selected_slot_id: tempSlots[selection - 1].id,
                         selected_slot_text: `${tempSlots[selection-1].time_start} - ${tempSlots[selection-1].time_end}`
                     };
                 }
             }

             // 2. Guardado genérico del input (skip for nodes that handle their own context)
             if (currentNode.type !== 'catalogNode' && currentNode.type !== 'slotNode' && currentNode.type !== 'pollNode' && currentNode.type !== 'stockCheckNode') {
                 const varName = (currentNode.data.variable || 'temp_input').trim();
                 console.log(`[FlowEngine] Saving input "${input}" to variable "${varName}"`);
                 execution.context = { ...execution.context, [varName]: input };
             }

             // Special: Stock Check Node — process input and save structured result
             if (currentNode.type === 'stockCheckNode') {
                 const stockResult = await StockCheckExecutor.processInput(input, currentNode.data, execution.context as any);
                 if (stockResult.updatedContext) {
                     execution.context = { ...execution.context, ...stockResult.updatedContext };
                 }
                 // Save context and advance, returning the stock response messages
                 await this.db.from('flow_executions')
                    .update({ context: execution.context })
                    .eq('id', execution.id);
                 return this.advanceToNextNode(execution, flow, stockResult.messages || []);
             }
             
             // Actualizar contexto en DB
             await this.db.from('flow_executions')
                .update({ context: execution.context })
                .eq('id', execution.id);
        }

        // 3. Mover al siguiente nodo
        return this.advanceToNextNode(execution, flow, []);
    }

    private async advanceToNextNode(execution: FlowExecution, flow: FlowDefinition, accumulatedMessages: string[], sourceHandle?: string): Promise<string[]> {
        // Find edges from current node
        const edges = flow.edges || [];
        
        // If we have a sourceHandle (e.g. from conditionNode), find specific edge
        let outgoingEdge;
        if (sourceHandle) {
             outgoingEdge = edges.find((e: any) => e.source === execution.current_node_id && e.sourceHandle === sourceHandle);
        } else {
             outgoingEdge = edges.find((e: any) => e.source === execution.current_node_id);
        }

        if (!outgoingEdge) {
            // End of Flow
            console.log("[FlowEngine] End of flow reached.");
            await this.db.from('flow_executions').update({ status: 'completed', completed_at: new Date() }).eq('id', execution.id);
            return accumulatedMessages;
        }

        const nextNodeId = outgoingEdge.target;
        console.log(`[FlowEngine] Advancing from ${execution.current_node_id} to ${nextNodeId}`);

        // Update Execution State
        await this.db.from('flow_executions')
            .update({ current_node_id: nextNodeId, last_activity: new Date() })
            .eq('id', execution.id);
        
        // Recursively execute the next node
        // Update local execution object for recursion
        execution.current_node_id = nextNodeId;
        
        const nextMessages = await this.executeStep(execution, null);
        return [...accumulatedMessages, ...nextMessages];
    }

    /**
     * Resuelve el voto de una encuesta comparando el hash recibido con las opciones del nodo actual.
     */
    async resolvePollVote(phone: string, voteHashStr: string): Promise<string | null> {
        // 1. Get execution
        const { data: execution } = await this.db
            .from('flow_executions')
            .select('*')
            .eq('phone', phone)
            .eq('status', 'WAITING_INPUT')
            .maybeSingle();

        if (!execution || !execution.flow_id) return null;

        // 2. Get Flow & Node
        const { data: flow } = await this.db
            .from('flows')
            .select('nodes')
            .eq('id', execution.flow_id)
            .single();

        if (!flow) return null;

        const currentNode = (flow.nodes || []).find((n: any) => n.id === execution.current_node_id);
        if (!currentNode || currentNode.type !== 'pollNode') return null;

        // 3. Reconstruct Options
        const options = currentNode.data.options || ['Si', 'No'];

        // 4. Calculate Hashes and Match
        // Baileys uses SHA-256 for poll options.
        const crypto = require('crypto');
        
        for (const opt of options) {
            const shasum = crypto.createHash('sha256');
            shasum.update(opt);
            const hash = shasum.digest('hex').toUpperCase();
            
            // Normalize generic incoming hash
            const incoming = voteHashStr.toUpperCase();

            // Check if matches (Baileys might rotate or salt, but standard is simple sha256)
            if (hash === incoming || incoming.includes(hash)) {
                return opt;
            }
        }
        
        return null; // No match found
    }
}
