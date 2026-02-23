import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class ConditionExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        const { variable, operator = 'equals', expectedValue } = data;
        const variableName = data.variable ? data.variable.trim() : '';
        const actualValue = variableName ? context[variableName] : undefined;
        
        const val1 = String(actualValue || '').trim().toLowerCase();
        const val2 = String(expectedValue || '').trim().toLowerCase();
        
        console.log(`[ConditionExecutor] Comparing "${val1}" ${operator} "${val2}" (Variable: ${variable})`);

        let result = false;
        if (operator === 'equals') result = val1 === val2;
        if (operator === 'not_equals') result = val1 !== val2;
        if (operator === 'contains') result = val1.includes(val2);
        if (operator === 'greater_than') result = Number(val1) > Number(val2); // Basic support
        if (operator === 'less_than') result = Number(val1) < Number(val2);   // Basic support
        
        console.log(`[ConditionExecutor] Result: ${result}`);

        // conditionNode doesn't send messages, just returns boolean for routing
        return { 
            messages: [],
            wait_for_input: false,
            conditionResult: result
        };
    }
}
