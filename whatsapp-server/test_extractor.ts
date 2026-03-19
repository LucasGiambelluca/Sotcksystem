import { EntityExtractor } from './src/core/nlu/EntityExtractor';
import { productService } from './src/services/ProductService';

async function test() {
    const extractor = new EntityExtractor();
    await extractor.loadCatalog();

    const tests = [
        "quiero una tarta de jamon y queso",
        "4 empanadas",
        "quiero 1 pollo a la parrilla con papas",
        "quiero 1 coca",
        "mandame una docena de empanadas de carne"
    ];
    
    for (const text of tests) {
        console.log(`\n\n--- Testing: "${text}" ---`);
        const entities = await extractor.extract(text);
        console.log("FINAL ENTITIES:");
        entities.forEach(e => {
            console.log(`- ${e.type}: ${e.value} (norm: ${e.normalizedValue}) pos:[${e.position}]`);
        });

        // Test searchSimilarProducts for the product matching
        const productsToAdd = entities.filter(e => e.type === 'product');
        for (const p of productsToAdd) {
             const similar = await productService.searchSimilarProducts(p.normalizedValue || p.value);
             console.log(`\nSimilar products for "${p.value}":`);
             similar.forEach(s => console.log(` - ${s.name} ($${s.price})`));
             
             const isAmbiguous = ['coca', 'sprite', 'pepsi', 'fanta', 'cerveza', 'agua', 'vino'].some(w => p.value.toLowerCase().includes(w));
             console.log(`Is Ambiguous? ${isAmbiguous && similar.length > 1}`);
        }
    }
}

test().catch(console.error);
