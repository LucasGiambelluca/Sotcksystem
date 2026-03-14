import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class ConditionExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        const { variable, operator = 'equals', expectedValue } = data;
        const variableName = data.variable ? data.variable.trim() : '';
        const actualValue = variableName ? context[variableName] : undefined;
        
        // Clean input: remove common WhatsApp markdown (*, _) and trim
        let val1 = String(actualValue || '').replace(/[\*_]/g, '').trim().toLowerCase();
        const val2 = String(expectedValue || '').trim().toLowerCase();
        
        // Extract numeric part (e.g. from "1." or "*1.*" or "opción 1")
        const numericMatch = val1.match(/\d+/);
        const extractedNum = numericMatch ? numericMatch[0] : null;
        
        // Regex-based matching for numeric options (e.g. "1", "1.", "*1*", "opción 1")
        const matchesNumeric = (text: string, expected: string) => {
            const pattern = new RegExp(`(^|\\D)${expected}(\\D|$)`);
            return pattern.test(text);
        };
        
        const isNumericMatch = matchesNumeric(val1, val2);
        
        // Also check if val1 (the text) is simply contained in the expected option (loose match)
        const isLooseMatch = val1.length >= 3 && val2.includes(val1);

        console.log(`[ConditionExecutor] Comparing "${val1}" ${operator} "${val2}" (Variable: ${variable})`);

        let result = false;
        if (operator === 'equals') result = (val1 === val2 || isNumericMatch || isLooseMatch);
        if (operator === 'not_equals') result = (val1 !== val2 && !isNumericMatch && !isLooseMatch);
        if (operator === 'contains') result = val1.includes(val2);
        if (operator === 'greater_than') result = Number(val1) > Number(val2);
        if (operator === 'less_than') result = Number(val1) < Number(val2);
        
        console.log(`[ConditionExecutor] Result: ${result} (Numeric: ${isNumericMatch}, Loose: ${isLooseMatch})`);

        // conditionNode doesn't send messages, just returns boolean for routing
        return { 
            messages: [],
            wait_for_input: false,
            conditionResult: result
        };
    }
}
