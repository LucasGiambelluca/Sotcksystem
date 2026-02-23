import { FlowEngine } from '../src/core/engine/flow.engine';
import * as path from 'path';

async function test() {
    console.log('Testing Flow Engine...');
    const engine = new FlowEngine();

    // Mock context
    const context = { userId: '123' };

    try {
        const flow = await engine.startFlow('main_menu', context);
        console.log('Start Flow Result:', flow);

        if (flow.currentState === 'WELCOME') {
            console.log('SUCCESS: Initial state is WELCOME');
        } else {
            console.error('FAILURE: Unexpected initial state');
        }

    } catch (error) {
        console.error('Test Failed:', error);
    }
}

test();
