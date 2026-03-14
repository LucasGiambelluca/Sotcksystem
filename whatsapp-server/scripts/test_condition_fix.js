const { ConditionExecutor } = require('../src/core/executors/ConditionExecutor');

async function testCondition() {
    const executor = new ConditionExecutor();
    
    const testCases = [
        { input: '1', expected: '1. Hacer Pedido', shouldMatch: true },
        { input: '2', expected: '2. Consultar Stock', shouldMatch: true },
        { input: '1. hacer pedido', expected: '1. Hacer Pedido', shouldMatch: true },
        { input: 'hacer pedido', expected: '1. Hacer Pedido', shouldMatch: false },
        { input: '10', expected: '1. Hacer Pedido', shouldMatch: false }
    ];

    console.log('--- Testing ConditionExecutor Numeric Match ---');
    for (const test of testCases) {
        const result = await executor.execute(
            { variable: 'test_var', expectedValue: test.expected },
            { test_var: test.input },
            {}
        );
        const passed = result.conditionResult === test.shouldMatch;
        console.log(`Input: "${test.input}" | Expected: "${test.expected}" | Result: ${result.conditionResult} | ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    }
}

testCondition();
