import { IntentClassifier } from '../../flows/intents/classifier';
import { FlowEngine } from './flow.engine';
import { BaileysAdapter } from '../gateway/baileys.adapter';

export class ConversationRouter {
    private intentClassifier: IntentClassifier;
    private flowEngine: FlowEngine;
    private gateway: BaileysAdapter;

    constructor(gateway: BaileysAdapter) {
        this.gateway = gateway;
        this.intentClassifier = new IntentClassifier();
        this.flowEngine = new FlowEngine();
    }

    async routeMessage(message: any, context: any) {
        let result: any;
        const userId = context.userId;
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        
        console.log(`[Router] Routing message from ${userId}: "${text}"`);

        // 1. Check if user is already in a flow
        if (context.currentFlow) {
            result = await this.flowEngine.continueFlow(context.currentFlow, message, context);
        } else {
            // 2. Classify intent if starting new
            const intent = await this.intentClassifier.classify(text);
            console.log(`[Router] Detected intent: ${intent} for text: ${text}`);
            
            // 3. Dispatch to flow based on intent
            try {
                if (intent === 'ORDER_FLOW') {
                    result = await this.flowEngine.startFlow('order', context);
                } else if (intent === 'SUPPORT_FLOW') {
                    result = await this.flowEngine.startFlow('support', context);
                } else {
                    // 4. Default fallback to Main Menu or Trigger Search
                    // If flowEngine.startFlow('main_menu') fails, it might return a specific fallback now
                    result = await this.flowEngine.startFlow(text, context); 
                }
                console.log(`[Router] Engine result:`, result ? 'Has result' : 'NULL');
            } catch (err) {
                 console.error(`[Router] 💥 Error in Engine execution:`, err);
            }
        }

        // 5. Execute actions / Send response
        if (result && result.currentStateDefinition) {
            const stateDef = result.currentStateDefinition;
            if (stateDef.message_template) {
                await this.gateway.sendMessage(userId, { text: stateDef.message_template });
            }
        }
    }
}
