import { supabase } from '../../config/database'; 
import { FlowDefinition, FlowExecution } from '../../flows/types/flow.types';
import { logger } from '../../utils/logger';
import { validateNode } from './node.validator';
import { sessionAuditor } from './session.auditor';
import { SessionQueue } from './session.queue';
import { SessionRepository } from '../../infrastructure/repositories/SessionRepository';
import { nodeExecutorFactory } from '../executors/NodeExecutorFactory';
import { Session } from '../domain/Session';
import { redisPersistence } from '../../infrastructure/persistence/RedisPersistenceService';
import { ConfigurationService } from '../../services/ConfigurationService';

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
        const globalTriggers = ['hola', 'menu', 'menú', 'cancelar', 'inicio', 'salir', 'testai'];
        const normalizedMsg = messageText.trim()
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/[^\w\sáéíóúüñ]/gi, '')
            .toLowerCase();
        
        let isGlobalTrigger = globalTriggers.includes(normalizedMsg);

        // EXTRA: If not a hardcoded global trigger, check if it's an EXACT trigger for ANY other flow.
        // This allows 'testai' or any new flow to "break" an old stuck session.
        if (!isGlobalTrigger) {
            const { data: matchedFlow } = await this.db.from('flows')
                .select('id')
                .eq('is_active', true)
                .or(`trigger_word.ilike.${normalizedMsg},trigger_word.ilike.%${normalizedMsg}%`)
                .maybeSingle();
            
            if (matchedFlow) {
                isGlobalTrigger = true;
                logger.info(`[FlowEngine] Dynamic global trigger detected: "${normalizedMsg}" matches flow ${matchedFlow.id}`);
            }
        }

        if (isGlobalTrigger) {
            logger.info(`[FlowEngine] Resetting session for ${phone} due to trigger: ${messageText}`);
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

            const accumulatedMessages: any[] = [];
            const previousNodeId = session?.currentNodeId || null;

            if (!session) {
                let flowId = options.flowId;
                let flow = null;

                if (flowId) {
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    const isUuid = uuidRegex.test(flowId);
                    if (isUuid) {
                        const { data: fetchedFlow } = await this.db.from('flows').select('id, name').eq('id', flowId).maybeSingle();
                        flow = fetchedFlow;
                    }
                    if (!flow) {
                        const { data: nameFlow } = await this.db.from('flows').select('id, name').eq('name', flowId).limit(1).maybeSingle();
                        flow = nameFlow;
                    }
                } else {
                    flow = await this.findFlowByTrigger(messageText);
                }

                if (!flow) {
                    return { currentStateDefinition: { message_template: '❌ No entendí. Escríbí "hola" para ver las opciones.' } };
                }
                
                flowId = flow.id;
                await this.sessionRepository.forceReset(cleanPhone);

                let businessContext: Record<string, any> = {};
                try {
                    const appConfig = await ConfigurationService.getFullConfig();
                    const { data: products } = await this.db.from('products').select('id, name, price').eq('available', true).limit(50);
                    
                    businessContext = {
                        catalog_business_name: appConfig.business_name || 'Tu Negocio',
                        direccion: appConfig.store_address || '',
                        horario_negocio: 'Consultar', // Se podría expandir en ConfigurationService si es necesario
                        zona_delivery: appConfig.shipping_policy || 'Consultar zona de cobertura',
                        catalog_summary: products?.map((p: any) => `${p.name} ($${p.price})`).join(', ') || 'Sin productos disponibles'
                    };
                } catch (e) {
                    logger.error(`[FlowEngine] Error building business context: ${e.message}`);
                }

                session = await this.sessionRepository.getOrCreate(sessionId, phone, flowId, {
                    variables: { global: { ...context, ...businessContext, pushName: context.pushName || 'Cliente', phoneNumber: phone, chatJid: remoteJid, phone: phone, startedAt: new Date().toISOString() } },
                    metadata: { flowId: flowId, flowVersion: 1, entryPoint: flowId === options.flowId ? 'manual' : 'trigger' }
                }, options.startNodeId || 'start');
                
                const expirationDate = new Date();
                expirationDate.setHours(expirationDate.getHours() + 2);
                session.getContext().metadata.expiresAt = expirationDate;
                
                if (!(options.startNodeId && options.startNodeId !== 'start')) {
                    const { data: startFlow } = await this.db.from('flows').select('nodes').eq('id', flowId).single();
                    const startNode = startFlow?.nodes?.find((n: any) => n.id === session.currentNodeId);
                    if (!(startNode && ['intentResolverNode', 'groqNode', 'questionNode'].includes(startNode.type))) {
                        await this.handleInput(session, this.normalizeInput(messageText));
                    }
                }
            } else {
                if (session.status === 'waiting_input') {
                    await this.handleInput(session, this.normalizeInput(messageText));
                    if ((session as any)._pendingMessages) {
                        accumulatedMessages.push(...(session as any)._pendingMessages);
                        delete (session as any)._pendingMessages;
                    }
                }
            }

            if (!session) throw new Error('Session initialization failed');

            // 2. Execute Node Chain (Only if moved or now active)
            if (session.currentNodeId !== previousNodeId || session.status === 'active') {
                const chainMessages = await this.executeNodeChain(session);
                accumulatedMessages.push(...chainMessages);
            }

            await this.sessionRepository.update(session);
            await redisPersistence.setCheckpoint(cleanPhone, {
                currentNodeId: session.currentNodeId,
                status: session.status,
                variables: session.getAllVariablesForCurrentFlow(),
                flowId: session.getContext().metadata.flowId
            });

            return { currentStateDefinition: { message_template: accumulatedMessages } };

        } catch (err: any) {
            logger.error(`[FlowEngine] Critical error`, { error: err.message });
            return { currentStateDefinition: { message_template: '⚠️ Ocurrió un error. Reintentá en un momento.' } };
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
                (session as any)._pendingMessages = result.messages;
            }
            if (result.isValidInput === false) {
                session.status = 'waiting_input';
                session.logInteraction(session.currentNodeId, input);
                return; // Exit handleInput early to keep waiting_input
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
                    // Set specific handle for routing (React Flow handle ID)
                    session.setVariable(`_poll_selected_handle_${currentNode.id}`, `option-${index}`);
                    logger.info(`[FlowEngine] [INPUT] Resolved poll input "${input}" to "${processedInput}" (Index: ${index + 1}, Handle: option-${index})`);
                } else {
                    // INVALID INPUT: Re-prompt the user instead of advancing
                    logger.info(`[FlowEngine] [INPUT] Invalid poll response: "${input}". Re-prompting user.`);
                    const optionLines = options.map((opt: string, i: number) => {
                        const cleanOpt = opt.replace(/^\d+[\s.)-]*\s*/, '');
                        return `*${i + 1}.* ${cleanOpt}`;
                    }).join('\n');
                    const question = currentNode.data?.question || 'Elegí una opción:';
                    (session as any)._pendingMessages = [`⚠️ No entendí tu respuesta. Por favor, elegí una opción válida:\n\n${question}\n\n${optionLines}\n\n_Respondé con el número de tu elección._`];
                    // Do NOT advance — keep waiting_input status
                    session.status = 'waiting_input';
                    session.logInteraction(session.currentNodeId, input);
                    return; // Exit handleInput early without advancing
                }
            }
            session.setVariable(varName, processedInput);
            session.setVariable(`${varName}_raw`, input);
        }

        session.logInteraction(session.currentNodeId, input);

        // 2. Advance to next node (Universal advancement for nodes that wait for input)
        // For intentResolverNodes, use the classified intent as edge handle for routing
        let advanceHandle: string | undefined;
        if (currentNode.type === 'intentResolverNode') {
            const outputVar = currentNode.data?.output_variable || 'intent_clasificado';
            advanceHandle = session.getVariable(outputVar);
            logger.info(`[FlowEngine] [INPUT] IntentResolver classified intent: "${advanceHandle}" (var: ${outputVar})`);
        } else if (currentNode.type === 'orderValidatorNode') {
            advanceHandle = session.getVariable('order_validation_result');
            logger.info(`[FlowEngine] [INPUT] OrderValidator selected: "${advanceHandle}"`);
        } else if (currentNode.type === 'pollNode') {
            // Use the handle stored during input processing
            advanceHandle = session.getVariable(`_poll_selected_handle_${currentNode.id}`);
            logger.info(`[FlowEngine] [INPUT] Poll selected handle: "${advanceHandle}"`);
        }

        const nextNodeId = this.findNextNodeId(flow, currentNode.id, advanceHandle);
        if (nextNodeId) {
            session.currentNodeId = nextNodeId;
            logger.info(`[FlowEngine] [INPUT] Advancing session from ${currentNode.id} to ${nextNodeId} (Type: ${currentNode.type}, Handle: ${advanceHandle || 'default'})`);
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
                    logger.error(`[FlowEngine] Flow not found: ${flowId}. Forcing session reset.`);
                    await this.sessionRepository.forceReset(session.userPhone);
                    accumulatedMessages.push('⚠️ Tu sesión anterior expiró o el menú cambió. Por favor, escribí "hola" para empezar de nuevo.');
                    break;
                }
                flow = fetchedFlow;
            }

            const currentNode = (flow.nodes || []).find((n: any) => n.id === session.currentNodeId);
            if (!currentNode) {
                logger.warn(`[FlowEngine] [RECOVERY] Node "${session.currentNodeId}" not found in flow "${flow.name}". Resetting to start node.`);
                const startNode = (flow.nodes || []).find((n: any) => 
                    n.type === 'start' || 
                    (n.data && n.data.type === 'start') || 
                    n.id === 'start'
                );
                if (startNode) {
                    session.currentNodeId = startNode.id;
                    continue; // Re-evaluate with the new start node
                }
                logger.error(`[FlowEngine] [CRITICAL] No start node found in flow "${flow.name}". Aborting.`);
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

            // Apply context updates from executor (Crucial for state persistence)
            if (result.updatedContext) {
                Object.entries(result.updatedContext).forEach(([k, v]) => {
                    session.setVariable(k, v);
                });
            }

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

            // SPECIAL CASE: AI Flow Control (Return to previous)
            if (result.updatedContext?.last_ai_completed) {
                const logs = session.getContext().interactionLog;
                const prevNode = [...logs].reverse().find(l => l.nodeId !== currentNode.id);
                if (prevNode) {
                    logger.info(`[FlowEngine] [AI RETURN] Returning to previous node ${prevNode.nodeId}`);
                    session.currentNodeId = prevNode.nodeId;
                    // We let it continue to execute the previous node (which will likely wait for input)
                    continue;
                }
            }

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
        const normalizedHandle = handle ? String(handle).toLowerCase().trim() : undefined;
        
        let edge;
        if (normalizedHandle) {
            edge = edges.find((e: any) => {
                if (e.source !== currentNodeId) return false;
                const srcHandle = String(e.sourceHandle || '').toLowerCase().trim();
                
                // 1. Direct match
                if (srcHandle === normalizedHandle) return true;

                // 2. Boolean synonyms (SUCCESS/TRUE/OK/CENTRO)
                const isPositive = ['true', 'yes', 'ok', 'success', 'centro', '1'].includes(normalizedHandle);
                const srcPositive = ['true', 'yes', 'ok', 'success', 'centro', '1'].includes(srcHandle);
                if (isPositive && srcPositive) return true;

                // 3. Negative synonyms (FAIL/FALSE/ERROR/FUERA DE ZONA)
                const isNegative = ['false', 'no', 'fail', 'error', 'fuera de zona', 'fuera', '0'].includes(normalizedHandle);
                const srcNegative = ['false', 'no', 'fail', 'error', 'fuera de zona', 'fuera', '0'].includes(srcHandle);
                if (isNegative && srcNegative) return true;

                return false;
            });

            if (!edge) {
                logger.warn(`[FlowEngine] [MEMORY-LOSS-WARNING] Node "${currentNodeId}" returned handle "${handle}", but NO matching edge found. Synonyms check also failed.`);
            }
        }
        
        // 4. Defaulting logic:
        // If we found an edge via handle, use it.
        // If NOT, only default to the first connection if the handle was undefined (linear path)
        // OR if the node is NOT a branching node.
        if (!edge) {
            const node = (flow.nodes || []).find((n: any) => n.id === currentNodeId);
            const isBranchingNode = ['pollNode', 'conditionNode', 'locationValidatorNode', 'orderValidatorNode'].includes(node?.type || '');
            
            if (!handle || !isBranchingNode) {
                edge = edges.find((e: any) => e.source === currentNodeId);
            } else {
                logger.error(`[FlowEngine] [STRICT-MODE] Branching node "${currentNodeId}" produced unhandled result "${handle}". Aborting branch to prevent wrong path execution.`);
            }
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
