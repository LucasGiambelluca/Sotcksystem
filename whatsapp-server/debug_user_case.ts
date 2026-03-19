
import { EntityExtractor } from './src/core/nlu/EntityExtractor';
import { OrderInterpreter } from './src/core/nlu/OrderInterpreter';
import 'dotenv/config';

async function debugUserCase() {
    const extractor = new EntityExtractor();
    const interpreter = new OrderInterpreter(extractor);
    await extractor.loadCatalog();

    console.log('--- Case 1: "quiero un pollo con fritas y una coca cola" ---');
    const res1 = await interpreter.interpret("quiero un pollo con fritas y una coca cola");
    console.log('Entities:', JSON.stringify(res1.entities.map(e => ({ value: e.value, normalized: e.normalizedValue })), null, 2));
    
    if (res1.parsedOrder) {
        console.log('Parsed Items:', res1.parsedOrder.items.map(i => `${i.quantity}x ${i.productName}`));
    }

    console.log('\n--- Case 2: "quitar el pollo a la parilla con fritas" ---');
    // Simulate what happens in handleOverrideResponse
    const extraction = await extractor.extract("quitar el pollo a la parilla con fritas");
    console.log('Extraction for removal:', JSON.stringify(extraction.map(e => ({ value: e.value, normalized: e.normalizedValue })), null, 2));
}

debugUserCase().catch(console.error);
