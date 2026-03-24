import { supabase } from '../../config/database'; 
import { FlowDefinition, FlowExecution } from '../../flows/types/flow.types';
import { logger } from '../../utils/logger';
import { validateNode } from './node.validator';
import { sessionAuditor } from './session.auditor';
import { SessionQueue } from './session.queue';
import { SessionRepository } from '../../infrastructure/repositories/SessionRepository';
import { nodeExecutorFactory } from '../executors/NodeExecutorFactory';
import { Session } from '../domain/Session';

export class FlowEngine {
    private db: any;
    private sessionQueues = new Map<string, SessionQueue>();
    private sessionRepository: SessionRepository;
    public orderService: any;
    public slotService: any;

    constructor(dbClient?: any, orderServiceInstance?: any, slotServiceInstance?: any) {
        this.db = dbClient || supabase;
        this.orderService = orderServiceInstance;
        this.slotService = slotServiceInstance;
        this.sessionRepository = new SessionRepository();
    }

    /**
     * Entry point for messages. Routes to the appropriate session queue.
     */
    async processMessage(phone: string, messageText: string, context: any = {}, options: { flowId?: string, startNodeId?: string } = {}): Promise<any> {
        const remoteJid = context.remoteJid || (phone.includes('@') ? phone : `${phone}@s.whatsapp.net`);
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const sessionId = remoteJid.endsWith('@g.us') ? `group:${remoteJid}` : `1to1:${cleanPhone}`;
        
        let queue = this.sessionQueues.get(sessionId);
        if (!queue) {
            queue = new SessionQueue(sessionId, (msg) => this.executeMessage(phone, msg.text, msg.context, msg.options));
            this.sessionQueues.set(sessionId, queue);
        }

        return queue.enqueue({ phone, text: messageText, context, options });
    }

    /**
     * Internal execution logic, called sequentially by the queue.
     */
    private async executeMessage(phone: string, messageText: string, context: any = {}, options: { flowId?: string, startNodeId?: string } = {}): Promise<any> {
        const startTime = Date.now();
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const remoteJid = context.remoteJid || (cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`);
        const sessionId = remoteJid.endsWith('@g.us') ? `group:${remoteJid}` : `1to1:${cleanPhone}`;

        logger.info(`[FlowEngine] Processing message in queue`, { sessionId, text: messageText.substring(0, 50) });

        // 0. GLOBAL INTERRUPTS (Reset logic)
        const globalTriggers = ['hola', 'menu', 'menú', 'cancelar', 'inicio', 'salir'];
        const isGlobalTrigger = globalTriggers.includes(messageText.trim().toLowerCase());

        if (isGlobalTrigger) {
            logger.info(`[FlowEngine] Global trigger detected`, { phone, trigger: messageText });
            await this.sessionRepository.forceReset(cleanPhone);
            
            // Clear handover status if present to resume bot control
            await this.db.from('whatsapp_conversations')
                .update({ status: 'active', updated_at: new Date().toISOString() })
                .eq('phone', cleanPhone)
                .eq('status', 'HANDOVER');
        }

        // 0.5. CHECK HANDOVER STATUS
        const { data: conversation } = await this.db.from('whatsapp_conversations').select('status').eq('phone', cleanPhone).maybeSingle();
        if (conversation?.status === 'HANDOVER' && !isGlobalTrigger) {
            logger.info(`[FlowEngine] Session in HANDOVER Mode for ${phone}. Skipping bot processing.`);
            return null;
        }

        // 1. Get/Create Session
        let session: Session | null = null;
        if (!isGlobalTrigger) {
            try {
                // Find active session
                const query = this.db
                    .from('flow_executions')
                    .select('*')
                    .eq('session_id', sessionId)
                    .in('status', ['active', 'waiting_input'])
                    // If expires_at exists, we ignore sessions that are already expired
                    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
                    // Prioritize 'waiting_input' since it's the most likely intentional state
                    .order('status', { ascending: false }) 
                    .order('updated_at', { ascending: false })
                    .limit(1);
                
                const { data: existingArray, error } = await query;
                const existing = existingArray && existingArray.length > 0 ? existingArray[0] : null;

                if (error) {
                    logger.error(`[FlowEngine] Query error for ${sessionId}`, { error: error.message, code: error.code });
                }

                if (existing) {
                    session = Session.fromJSON(existing);
                    logger.info(`[FlowEngine] Session found: ${session.id} | Node: ${session.currentNodeId} | Status: ${session.status}`);
                } else {
                    logger.info(`[FlowEngine] No active session found for JID: ${sessionId}`);
                    // Debug: Are there ANY sessions for this phone?
                    const { data: allPhoneSessions } = await this.db.from('flow_executions').select('session_id, status').eq('phone', cleanPhone);
                    logger.info(`[FlowEngine] DEBUG: All sessions for phone ${cleanPhone}`, { count: allPhoneSessions?.length, sessions: allPhoneSessions });
                }
            } catch (err: any) {
                logger.error(`[FlowEngine] Error matching session`, { error: err.message, sessionId });
            }
        }

        try {
            const cleanMessage = messageText.trim().toLowerCase();
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            const sessionId = `1to1:${cleanPhone}`;
            const remoteJid = context.remoteJid || `${cleanPhone}@s.whatsapp.net`;

            if (!session) {
                let flowId = options.flowId;
                let flow = null;

                if (flowId) {
                    logger.info(`[FlowEngine] Attempting to fetch flow by ID: "${flowId}"`);
                    const { data: fetchedFlow, error: fetchError } = await this.db.from('flows').select('id, name').eq('id', flowId).maybeSingle();
                    
                    if (!fetchedFlow) {
                        logger.warn(`[FlowEngine] Flow ID ${flowId} not found. Attempting fallback by name...`);
                        const { data: fallbackFlow } = await this.db.from('flows')
                            .select('id, name')
                            .ilike('name', '%Tomar Pedido%')
                            .limit(1)
                            .maybeSingle();
                        flow = fallbackFlow;
                    } else {
                        flow = fetchedFlow;
                    }
                    
                    if (fetchError) logger.error(`[FlowEngine] Error fetching flow ${flowId}:`, fetchError);
                } else {
                   flow = await this.findFlowByTrigger(messageText);
                }

                if (!flow) {
                    logger.info(`[FlowEngine] No flow matched for: "${messageText}" (FlowId: ${flowId || 'none'})`);
                    const fallbackMessage = '❌ No entendí. Escríbí "hola" o "menú" para ver las opciones.';
                    return { currentStateDefinition: { message_template: fallbackMessage } };
                }
                
                flowId = flow.id;
                logger.info(`[FlowEngine] Using flow "${flow.name}" (${flowId}). Forcing session reset.`);
                await this.sessionRepository.forceReset(cleanPhone);

                session = await this.sessionRepository.getOrCreate(sessionId, phone, flowId, {
                    variables: { 
                        global: { 
                            ...context, // Merge ALL external context
                            pushName: context.pushName || 'Cliente',
                            phoneNumber: phone,
                            chatJid: remoteJid,
                            phone: phone, // redundante pero seguro
                            startedAt: new Date().toISOString()
                        } 
                    },
                    metadata: { flowId: flowId, flowVersion: 1, entryPoint: flowId === options.flowId ? 'manual' : 'trigger' }
                }, options.startNodeId || 'start');
                
                const TTL_HOURS = 2;
                const expirationDate = new Date();
                expirationDate.setHours(expirationDate.getHours() + TTL_HOURS);
                session.getContext().metadata.expiresAt = expirationDate;
                
                if (options.startNodeId && options.startNodeId !== 'start') {
                    logger.info(`[FlowEngine] Programmatic start at ${options.startNodeId}. Skipping initial trigger input handling.`);
                } else {
                    await this.handleInput(session, this.normalizeInput(messageText));
                }
            } else {
                // EXISTING SESSION: Always handle input if it was waiting
                if (session.status === 'waiting_input') {
                    await this.handleInput(session, this.normalizeInput(messageText));
                }
            }

            // 2. Execute Node Chain
            const resultMessages = await this.executeNodeChain(session);

            // 3. Save Session
            await this.sessionRepository.update(session);

            return {
                currentStateDefinition: {
                    message_template: resultMessages 
                }
            };

        } catch (err: any) {
            logger.error(`[FlowEngine] Critical error during execution`, { error: err.message, sessionId });
            sessionAuditor.log({
                session_id: sessionId,
                user_phone: phone,
                event_type: 'node_execution',
                details: { status: 'error', error: err.message, stack: err.stack }
            });
            return { currentStateDefinition: { message_template: '⚠️ Ocurrió un error. Escribí "hola" para reiniciar.' } };
        }
    }

    private async handleInput(session: Session, input: string): Promise<void> {
        session.status = 'active'; // Mark as active now that we got input
        const flowId = session.getContext().metadata.flowId;
        const { data: flow } = await this.db.from('flows').select('nodes, edges').eq('id', flowId).single();
        if (!flow) return;

        const currentNode = (flow.nodes || []).find((n: any) => n.id === session.currentNodeId);
        if (!currentNode) return;

        let processedInput = input;
        const varName = (currentNode.data?.variable || 'user_choice').trim();

        // 1. Specialized input handling via Executor
        const executor = nodeExecutorFactory.getExecutor(currentNode.type);
        if (executor.handleInput) {
            const result = await executor.handleInput(input, currentNode.data, session.getAllVariablesForCurrentFlow() as any);
            
            // Apply context updates from executor
            if (result.updatedContext) {
                Object.entries(result.updatedContext).forEach(([k, v]) => {
                    session.setVariable(k, v);
                });
            }
            
            // If the executor returned immediate messages (like Stock results), add them to session logs 
            // or we might need to handle how they are sent. 
            // For now, let's assume session variables are the source of truth for the NEXT node.
            if (result.messages && result.messages.length > 0) {
                // These messages usually want to be seen immediately.
                // We'll return them in handleInput so executeMessage can prepend them?
                // Actually, let's just use the messages in the next execution cycle.
                (session as any)._pendingMessages = result.messages;
            }
        } else {
            // Default behavior: just store the raw input
            // Poll handling (Legacy/Hardcoded): resolve numeric input to option text
            if (currentNode.type === 'pollNode') {
                const options = currentNode.data?.options || ['Sí', 'No'];
                const numericMatch = input.replace(/[\*_]/g, '').match(/\d+/);
                let index = numericMatch ? parseInt(numericMatch[0]) - 1 : -1;
                
                if (index < 0 || index >= options.length) {
                    // Try exact ignore-case match
                    const exactIndex = options.findIndex((o: string) => o.toLowerCase().trim() === input.toLowerCase().trim());
                    if (exactIndex !== -1) {
                        index = exactIndex;
                    } else {
                        // AI-Powered Semantic Matching
                        try {
                            const { AIExtractor } = require('../nlu/AIExtractor');
                            const aiIndex = await AIExtractor.resolveMenuOption(input, options);
                            if (aiIndex !== -1) {
                                index = aiIndex;
                                logger.info(`[FlowEngine] [AI INPUT] Semantically resolved "${input}" to option ${index + 1}: "${options[index]}"`);
                            }
                        } catch (e) {
                            logger.error('[FlowEngine] Error resolving semantic poll input', e);
                        }
                    }
                }

                if (index >= 0 && index < options.length) {
                    processedInput = options[index];
                    session.setVariable(`${varName}_index`, (index + 1).toString());
                    logger.info(`[FlowEngine] [INPUT] Resolved poll input "${input}" to "${processedInput}" (Index: ${index + 1})`);
                }
            }
            session.setVariable(varName, processedInput);
            session.setVariable(`${varName}_raw`, input);
        }

        session.logInteraction(session.currentNodeId, input);

        // 2. Advance to next node (Universal advancement for nodes that wait for input)
        const nextNodeId = this.findNextNodeId(flow, currentNode.id);
        if (nextNodeId) {
            session.currentNodeId = nextNodeId;
            logger.info(`[FlowEngine] [INPUT] Advancing session from ${currentNode.id} to ${nextNodeId} (Type: ${currentNode.type})`);
        }
    }

    private async executeNodeChain(session: Session): Promise<string[]> {
        let accumulatedMessages: string[] = (session as any)._pendingMessages || [];
        (session as any)._pendingMessages = []; // Clear after moving to accumulator
        
        let iterations = 0;
        const MAX_ITERATIONS = 50;

        let flow: any = null;
        
        while (iterations < MAX_ITERATIONS) {
            iterations++;
            
            const flowId = session.getContext().metadata.flowId;
            
            // Optimization: Only fetch flow once per execution chain if same flowId
            if (!flow || flow.id !== flowId) {
                const { data: fetchedFlow } = await this.db.from('flows').select('*').eq('id', flowId).single();
                if (!fetchedFlow) {
                    logger.error(`[FlowEngine] Flow not found: ${flowId}`);
                    break;
                }
                flow = fetchedFlow;
            }

            const currentNode = (flow.nodes || []).find((n: any) => n.id === session.currentNodeId);
            if (!currentNode) {
                logger.warn(`[FlowEngine] [END] Node not found: ${session.currentNodeId}`);
                break;
            }

            logger.info(`[FlowEngine] [TRAVERSE] Node: ${currentNode.id} (${currentNode.type})`);

            // Audit Start
            logger.debug(`[FlowEngine] Executing node ${currentNode.id} (${currentNode.type})`);
            sessionAuditor.log({
                session_id: session.id,
                user_phone: session.userPhone,
                event_type: 'node_execution',
                details: { status: 'started', node_id: currentNode.id, node_type: currentNode.type }
            });

            // 2.3. Execute
            const executor = nodeExecutorFactory.getExecutor(currentNode.type);
            const context = { ...session.getAllVariablesForCurrentFlow(), phone: session.userPhone };
            
            const stepStartTime = Date.now();
            const result = await executor.execute(currentNode.data, context as any, this);
            const stepDuration = Date.now() - stepStartTime;

            // 2.4. Visual Debug Path (Phase 4)
            const debugEmoji = iterations === 1 ? '🚀' : '➡️';
            console.log(`\x1b[36m[DEBUG-PATH] ${debugEmoji} Node: ${currentNode.id} (${currentNode.type})${result.conditionResult !== undefined ? ` | Condition: ${result.conditionResult}` : ''}\x1b[0m`);

            // SPECIAL CASE: Flow Link (Switching flows)
            if (currentNode.type === 'flowLinkNode' && currentNode.data?.flowId) {
                const targetFlowId = currentNode.data.flowId;
                logger.info(`[FlowEngine] Switching flow for session ${session.id} -> ${targetFlowId}`);
                
                // Switch context/flow in session
                session.getContext().metadata.flowId = targetFlowId;
                session.currentNodeId = 'start'; // Jump to start of new flow
                
                // We continue the loop with the new flow
                continue;
            }
            const messages = result.messages || [];
            if (messages.length > 0) {
                logger.info(`[FlowEngine] [OUTPUT] Node ${currentNode.id} generated ${messages.length} messages`);
            }
            accumulatedMessages.push(...messages);

            // Audit Step to DB (Phase 4) - Non-blocking to prevent timeouts
            this.logStepToDB(session, currentNode, result, stepDuration);

            // Audit End (Legacy)
            sessionAuditor.log({
                session_id: session.id,
                user_phone: session.userPhone,
                event_type: 'node_execution',
                details: { status: 'completed', node_id: currentNode.id, messages: messages.length }
            });

            if (result.wait_for_input) {
                console.log(`\x1b[33m[DEBUG-PATH] ⏸️ Waiting for input at ${currentNode.id}\x1b[0m`);
                session.status = 'waiting_input';
                break;
            }

            // Advance
            const handle = result.conditionResult !== undefined ? String(result.conditionResult) : undefined;
            const nextNodeId = this.findNextNodeId(flow, session.currentNodeId, handle);
            
            if (!nextNodeId) {
                console.log(`\x1b[32m[DEBUG-PATH] ✅ Flow Finished at ${currentNode.id}\x1b[0m`);
                session.status = 'completed';
                await this.sessionRepository.archive(session.id, 'flow_completed');
                break;
            }

            session.currentNodeId = nextNodeId;
        }

        return accumulatedMessages;
    }

    private findNextNodeId(flow: FlowDefinition, currentNodeId: string, handle?: string): string | null {
        const edges = flow.edges || [];
        const normalizedHandle = handle ? handle.toLowerCase() : undefined;
        
        let edge;
        if (normalizedHandle) {
            edge = edges.find((e: any) => {
                if (e.source !== currentNodeId) return false;
                const srcHandle = String(e.sourceHandle || '').toLowerCase();
                if (normalizedHandle === 'true' && (srcHandle === 'true' || srcHandle === 'yes')) return true;
                if (normalizedHandle === 'false' && (srcHandle === 'false' || srcHandle === 'no')) return true;
                return srcHandle === normalizedHandle;
            });
        }
        
        // Fallback to the first connection from this source if no handle-specific edge was found
        // or if there's no handle required.
        if (!edge) {
            edge = edges.find((e: any) => e.source === currentNodeId);
        }
            
        return edge ? edge.target : null;
    }

    private async findFlowByTrigger(text: string): Promise<FlowDefinition | null> {
        const cleanText = text.trim().toLowerCase();
        const { data, error } = await this.db
            .from('flows')
            .select('id, name, trigger_word, is_active')
            .eq('is_active', true)
            .or(`trigger_word.ilike.${cleanText},trigger_word.ilike.%${cleanText}%`);

        if (error || !data || data.length === 0) return null;
        
        // 1. Try to find an exact trigger match
        const exactMatches = data.filter((f: any) => 
            f.trigger_word?.toLowerCase().split(',').map((t: string) => t.trim()).includes(cleanText)
        );

        if (exactMatches.length > 0) {
            // Priority for common triggers (hola, menu): prefer flows with "bienv" or "welcome" in the name
            if (['hola', 'menu', 'menú', 'inicio'].includes(cleanText)) {
                const prioritized = exactMatches.find((f: any) => 
                    f.name.toLowerCase().includes('bienv') || 
                    f.name.toLowerCase().includes('welcome')
                );
                if (prioritized) return prioritized;
            }
            return exactMatches[0];
        }

        return data[0]; // Fallback to partial match
    }

    /**
     * Resuelve el voto de una encuesta comparando el hash recibido con las opciones del nodo actual.
     */
    async resolvePollVote(phone: string, voteHashStr: string): Promise<string | null> {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const sessionId = `1to1:${cleanPhone}`;
        
        // 1. Get execution
        const { data: execution } = await this.db
            .from('flow_executions')
            .select('*')
            .eq('session_id', sessionId)
            .in('status', ['active', 'waiting_input'])
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
        const crypto = require('crypto');
        const incoming = voteHashStr.toUpperCase();
        
        // Clean input: remove common WhatsApp markdown (*, _) and trim
        const val1 = incoming.replace(/[\*_]/g, '').trim().toLowerCase();
        
        // Extract numeric part (e.g. from "1." or "*1.*" or "opción 1")
        const numericMatch = val1.match(/\d+/);
        const extractedNum = numericMatch ? numericMatch[0] : null;
        const optionIndex = extractedNum ? parseInt(extractedNum) - 1 : -1;

        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const shasum = crypto.createHash('sha256');
            shasum.update(opt);
            const hash = shasum.digest('hex').toUpperCase();

            if (hash === incoming || incoming.includes(hash) || i === optionIndex) {
                return opt;
            }
        }
        
        return null; // No match found
    }

    private async logStepToDB(session: Session, node: any, result: any, duration: number): Promise<void> {
        try {
            await this.db.from('flow_logs').insert({
                session_id: session.id,
                phone: session.userPhone,
                flow_id: session.getContext().metadata.flowId,
                node_id: node.id,
                node_type: node.type,
                input_text: session.getContext().interactionLog[session.getContext().interactionLog.length - 1]?.input,
                output_messages: result.messages || [],
                execution_time_ms: duration,
                metadata: {
                    condition_result: result.conditionResult,
                    wait_for_input: result.wait_for_input,
                    vars: session.getAllVariablesForCurrentFlow()
                }
            });
        } catch (err: any) {
            logger.error(`[FlowEngine] Error logging step to DB`, { error: err.message });
        }
    }

    private normalizeInput(text: string): string {
        if (!text) return '';
        // 1. Remove invisible characters and trim
        // 2. Remove common extra symbols but keep numbers and letters
        // 3. Lowercase everything
        return text.trim()
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Invisible chars
            .replace(/[^\w\sáéíóúüñ]/gi, '') // Keep letters/numbers/spaces
            .toLowerCase();
    }

    async resumeSession(phone: string, context: any = {}): Promise<any> {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const remoteJid = context.remoteJid || `${cleanPhone}@s.whatsapp.net`;
        const sessionId = remoteJid.endsWith('@g.us') ? `group:${remoteJid}` : `1to1:${cleanPhone}`;
        
        const { data: existing } = await this.db.from('flow_executions')
            .select('*').eq('session_id', sessionId).in('status', ['active', 'waiting_input']).limit(1).maybeSingle();
        
        if (!existing) return null;
        
        const session = Session.fromJSON(existing);
        const resultMessages = await this.executeNodeChain(session);
        await this.sessionRepository.update(session);

        return { currentStateDefinition: { message_template: resultMessages } };
    }
}
