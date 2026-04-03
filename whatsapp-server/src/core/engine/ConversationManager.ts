import { createMachine, createActor } from 'xstate';
import { Session } from '../domain/Session';
import { logger } from '../../utils/logger';

export const conversationMachine = createMachine({
  id: 'conversation',
  initial: 'IDLE',
  states: {
    IDLE: {
      on: {
        ORDER_START: 'TAKING_ORDER',
        HELP_REQUEST: 'IDLE',
        CANCEL: 'IDLE'
      }
    },
    TAKING_ORDER: {
      on: {
        ITEMS_ADDED: 'TAKING_ORDER',
        AMBIGUITY_DETECTED: 'CLARIFYING',
        ORDER_READY: 'CONFIRMING',
        CANCEL: 'IDLE'
      }
    },
    CLARIFYING: {
      on: {
        ITEM_RESOLVED: 'CONFIRMING',
        STILL_AMBIGUOUS: 'CLARIFYING',
        CANCEL: 'IDLE'
      }
    },
    CONFIRMING: {
      on: {
        CONFIRMED: 'PAYMENT',
        REJECTED: 'TAKING_ORDER',
        CANCEL: 'IDLE'
      }
    },
    PAYMENT: {
      on: {
        PAID: 'COMPLETED',
        CANCEL: 'IDLE'
      }
    },
    COMPLETED: {
      after: {
        1000: 'IDLE'
      }
    }
  }
});

export class ConversationManager {
    static async handleTransition(session: Session, event: string): Promise<string> {
        const currentState = session.getConversationalState();
        
        // Simple logic-based transition simulator for now (migratable to full XState actor)
        // because XState 5+ is async-first and more complex to hydrate/dehydrate in a stateless env
        
        const transitions: Record<string, Record<string, string>> = {
            IDLE: {
                ORDER: 'TAKING_ORDER',
                CANCEL: 'IDLE'
            },
            TAKING_ORDER: {
                AMBIGUOUS: 'CLARIFYING',
                READY: 'CONFIRMING',
                CANCEL: 'IDLE'
            },
            CLARIFYING: {
                RESOLVED: 'CONFIRMING',
                CANCEL: 'IDLE'
            },
            CONFIRMING: {
                YES: 'PAYMENT',
                NO: 'TAKING_ORDER',
                CANCEL: 'IDLE'
            },
            PAYMENT: {
                COMPLETE: 'IDLE',
                CANCEL: 'IDLE'
            }
        };

        const nextState = transitions[currentState]?.[event] || currentState;
        
        if (nextState !== currentState) {
            logger.info(`[ConversationManager] Transition: ${currentState} -> ${nextState} (Event: ${event})`);
            session.setConversationalState(nextState);
        }

        return nextState;
    }
}
