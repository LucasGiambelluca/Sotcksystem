
console.log('--- Script Starting ---');
import { EntityExtractor } from './src/core/nlu/EntityExtractor';
import { OrderInterpreter } from './src/core/nlu/OrderInterpreter';
import 'dotenv/config';

console.log('--- Imports Done ---');

async function testNlu() {
    console.log('--- Inside testNlu ---');
    const extractor = new EntityExtractor();
    const interpreter = new OrderInterpreter(extractor);

    console.log('--- Loading Catalog ---');
    try {
        await extractor.loadCatalog();
        console.log('--- Catalog Loaded ---');
    } catch (e) {
        console.error('--- Catalog Load Failed ---', e);
        return;
    }

    const text = "quiero 1 pollo con papas y 1 coca";
    console.log(`\n--- Interpreting: "${text}" ---`);
    try {
        const result = await interpreter.interpret(text);
        console.log('\nResult Type:', result.type);
        console.log('Confidence:', result.confidence);
        console.log('Entities:', JSON.stringify(result.entities, null, 2));
        
        if (result.parsedOrder) {
            console.log('\nParsed Order Items:');
            result.parsedOrder.items.forEach((item, i) => {
                console.log(`${i+1}. ${item.quantity}x ${item.productName} (ID: ${item.productId}) - Price: $${item.basePrice} - Confidence: ${item.confidence}`);
            });
        } else {
            console.log('\nNo parsed order found.');
        }
    } catch (e) {
        console.error('--- Interpretation Failed ---', e);
    }
}

console.log('--- Calling testNlu ---');
testNlu().then(() => console.log('--- Done ---')).catch(console.error);
