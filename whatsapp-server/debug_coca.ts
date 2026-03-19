
import { EntityExtractor } from './src/core/nlu/EntityExtractor';
import { productService } from './src/services/ProductService';
import 'dotenv/config';

async function debugCoca() {
    const extractor = new EntityExtractor();
    await extractor.loadCatalog();

    console.log('\n--- Extraction for: "quitar coca cola" ---');
    const extraction = await extractor.extract("quitar coca cola");
    console.log('Entities:', JSON.stringify(extraction.map(e => ({ value: e.value, normalized: e.normalizedValue, id: e.metadata?.productId })), null, 2));

    const products = extraction.filter(e => e.type === 'product');
    console.log('Products found:', products.length);
}

debugCoca().catch(console.error);
