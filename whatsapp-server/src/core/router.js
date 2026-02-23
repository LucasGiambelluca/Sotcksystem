const sessionStore = require('./sessionStore');
const Parser = require('./parser');
// We require flows lazily inside or at top if safe.
// Let's require at top to be clean.
const flows = require('../flows'); 

class Router {
    async processMessage(phone, text, pushName, context = {}) {
        const cleanText = text.trim().toLowerCase();
        
        console.log(`[ROUTER] ${phone} | Msg: "${text}" | Processing...`);

        // 0. Hybrid Engine Check (Dynamic Flows)
        try {
            // Import dynamically to avoid TS compilation issues in pure JS if needed, 
            // but since we run with ts-node, require is fine.
            const { default: hybridEngine } = require('./engine'); 
            const dynamicResponses = await hybridEngine.processMessage(phone, text, context);
            
            // Check if response is the new object format { currentStateDefinition: { message_template: ... } }
            if (dynamicResponses && dynamicResponses.currentStateDefinition) {
                 console.log(`[ROUTER] Handled by FlowEngine`);
                 const template = dynamicResponses.currentStateDefinition.message_template;
                 
                 // If template is already an array (our new FlowEngine behavior), return it directly.
                 if (Array.isArray(template)) {
                     return template;
                 }
                 // If it's a single item (string or object), wrap it in array
                 return template ? [template] : [];
            }

            // Fallback for array format (legacy)
            if (dynamicResponses && Array.isArray(dynamicResponses)) {
                 console.log(`[ROUTER] Handled by FlowEngine (Array)`);
                 return dynamicResponses;
            }
        } catch (err) {
            console.error(`[ROUTER] Hybrid Engine Error (ignoring):`, err);
        }

        // 1. Get Session
        let session = await sessionStore.get(phone);

        // 2. New Session Handling
        if (!session) {
            console.log(`[NEW USER] ${phone} - Creating session`);
            session = {
                phone,
                step: 'welcome', // Force welcome
                data: { 
                    items: [], 
                    pushName: pushName || 'Usuario'
                },
                lastActivity: Date.now()
            };
            await sessionStore.save(phone, session);

            // Execute "enter" of welcome flow explicitly
            const welcomeFlow = flows.welcome;
            if (welcomeFlow && welcomeFlow.enter) {
                const messages = await welcomeFlow.enter(session);
                return messages || [];
            }
            return [];
        }

        console.log(`[EXISTING] ${phone} - Step: ${session.step} | Status: ${session.status}`);

        // 2.5 Check Handover Status
        if (session.status === 'HANDOVER') {
            // Check if message is a "resume" command (e.g. from admin or specialized flow)
            // For now, only "reset" breaks out, or we can add a specific code.
            if (cleanText === 'reset' || cleanText === 'reiniciar' || cleanText === 'resume') {
                console.log(`[HANDOVER] Resuming bot for ${phone}`);
                session.status = 'ACTIVE';
                await sessionStore.save(phone, session);
                // Proceed to normal handling below
            } else {
                console.log(`[HANDOVER] Ignored message from ${phone} (Human Agent Active)`);
                return []; // Do nothing, let human answer
            }
        }

        // 3. Global Commands
        if (['cancelar', 'reiniciar', 'reset', 'empezar de nuevo'].includes(cleanText)) {
            console.log(`[CMD] Resetting session for ${phone}`);
            await sessionStore.delete(phone);
            
            // Re-initialize to show welcome menu immediately
            const newSession = {
                phone, 
                step: 'welcome',
                data: { items: [], pushName: pushName || 'Usuario' },
                lastActivity: Date.now()
            };
            await sessionStore.save(phone, newSession);
            return await flows.welcome.enter(newSession);
        }

        if (cleanText === 'menu') {
            session.step = 'welcome'; // Reset step to welcome
            await sessionStore.save(phone, session);
            return await flows.welcome.enter(session);
        }

        // 4. Stock Inquiry Detection (intercept from any step except 'stock')
        if (session.step !== 'stock') {
            const stockInquiry = Parser.detectStockInquiry(text);
            if (stockInquiry) {
                console.log(`[ROUTER] Stock inquiry detected: ${JSON.stringify(stockInquiry)}`);
                const stockFlow = flows.stock;
                if (stockFlow && stockFlow.processInquiry) {
                    const result = await stockFlow.processInquiry(stockInquiry, session);
                    
                    // Switch to stock step so follow-up yes/no goes to stock.flow
                    session.step = 'stock';
                    if (result.data) {
                        session.data = { ...session.data, ...result.data };
                    }
                    await sessionStore.save(phone, session);
                    
                    return result.messages || [];
                }
            }
        }

        // 5. Delegate to Current Flow
        const currentFlow = flows[session.step];
        if (!currentFlow) {
            console.error(`Missing flow for step: ${session.step}`);
            // Fallback to welcome
            session.step = 'welcome';
            await sessionStore.save(phone, session);
            return ["⚠️ Error de estado. Reiniciando..."].concat(await flows.welcome.enter(session));
        }

        try {
            let result;
            if (currentFlow.handle) {
                result = await currentFlow.handle(text, session);
            } else {
                result = {}; 
            }

            const responses = result.messages || [];

            // 5. Transition Actions
            if (result.nextStep) {
                console.log(`[TRANSITION] ${phone}: ${session.step} -> ${result.nextStep}`);
                
                session.step = result.nextStep;
                // Merge data properly
                if (result.data) {
                    session.data = { ...session.data, ...result.data };
                }
                
                await sessionStore.save(phone, session);

                // Auto-trigger "enter" of new step
                const nextFlow = flows[result.nextStep];
                if (nextFlow && nextFlow.enter) {
                    const enterMsgs = await nextFlow.enter(session);
                    if (enterMsgs) responses.push(...enterMsgs);
                }
            } else {
                // Stay same step, update data
                if (result.data) {
                    session.data = { ...session.data, ...result.data };
                    await sessionStore.save(phone, session);
                }
            }

            return responses;

        } catch (err) {
            console.error('Flow Execution Error:', err);
            return ['⚠️ Ocurrió un error. Escribí "Cancelar" para reiniciar.'];
        }
    }

    async handlePollUpdate(phone, voteHash) {
        try {
            const { default: hybridEngine } = require('./engine');
            // Resolve hash to text using FlowEngine
            const resolvedText = await hybridEngine.resolvePollVote(phone, voteHash);

            if (resolvedText) {
                console.log(`[ROUTER] Poll Resolved: "${resolvedText}" for ${phone}`);
                // Treat as normal text message
                return await this.processMessage(phone, resolvedText);
            } else {
                console.warn(`[ROUTER] Could not resolve poll vote hash: ${voteHash}`);
                return [];
            }
        } catch (err) {
            console.error('[ROUTER] Poll Handling Error:', err);
            return [];
        }
    }
}

module.exports = new Router();
