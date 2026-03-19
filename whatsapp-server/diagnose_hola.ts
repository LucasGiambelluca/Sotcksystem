
import { EntityExtractor } from './src/core/nlu/EntityExtractor';
import { OrderInterpreter } from './src/core/nlu/OrderInterpreter';
import 'dotenv/config';

async function testNlu() {
    const extractor = new EntityExtractor();
    const interpreter = new OrderInterpreter(extractor);

    console.log('--- Loading Catalog ---');
    await extractor.loadCatalog();

    const text = "hola";
    console.log(`\n--- Interpreting: "${text}" ---`);
    const result = await interpreter.interpret(text);

    console.log('\nResult Type:', result.type);
    console.log('Confidence:', result.confidence);
    console.log('Entities:', JSON.stringify(result.entities, null, 2));
}

testNlu().catch(console.error);
