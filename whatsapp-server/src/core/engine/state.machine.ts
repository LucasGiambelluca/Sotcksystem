import { createMachine, assign, fromPromise } from 'xstate';

export interface ConversationContext {
    userId: string;
    userName?: string;
    currentFlow?: string;
    cart: any[];
    history: any[];
}

export const conversationMachine = createMachine({
  id: 'conversation',
  initial: 'idle',
  context: {
    userId: '',
    cart: [],
    history: []
  } as ConversationContext,
  states: {
    idle: {
      on: {
        MESSAGE_RECEIVED: {
          target: 'processing',
          actions: 'logMessage'
        }
      }
    },
    processing: {
      invoke: {
        src: 'classifyIntent',
        onDone: [
            {
                target: 'routing',
                actions: assign({ currentFlow: ({ event }) => (event as any).data.flow })
            }
        ],
        onError: {
            target: 'idle',
            actions: 'logError'
        }
      }
    },
    routing: {
        always: [
            { target: 'flow_orders', guard: ({ context }) => context.currentFlow === 'order' },
            { target: 'flow_support', guard: ({ context }) => context.currentFlow === 'support' },
            { target: 'fallback' }
        ]
    },
    flow_orders: {
        // Placeholder for sub-machine or references
        type: 'final' 
    },
    flow_support: {
        type: 'final'
    },
    fallback: {
        entry: 'sendFallbackMessage',
        always: 'idle'
    }
  }
}, {
    actions: {
        logMessage: (context, event) => console.log('Message received:', event),
        logError: (context, event) => console.error('Error:', event),
        sendFallbackMessage: (context, event) => console.log('Sending fallback message')
    },
    actors: {
        classifyIntent: fromPromise(async ({ input }: { input: any }) => {
            // Mock intent classification
            return { flow: 'order' };
        })
    }
});
