const { EntityExtractor } = require('./src/core/nlu/EntityExtractor');
const ProductService = require('./src/services/ProductService').default;

async function test() {
    const extractor = new EntityExtractor();
    const cleanTerm = "docena de empanadas de carne";
    
    // Test normalization
    const norm = extractor.normalizeText(cleanTerm);
    console.log("Extractor normalized:", norm);
    
    // Let's test ProductService directly
    // Mock products
    ProductService.productsCache = [
        { id: '1', name: 'Doc. emp. carne', price: 1000, stock: 10, category: 'Empanadas' },
        { id: '2', name: 'Empanada de Carne frita', price: 500, stock: 10, category: 'Empanadas' }
    ];
    ProductService.cacheTimestamp = Date.now();
    
    const term = "docena de empanadas de carne";
    
    // Simulate what ProductService does:
                 
    const cleanProdName1 = ProductService.normalize('Doc. emp. carne');
    const cleanProdName2 = ProductService.normalize('Empanada de Carne frita');
    const cleanInput = ProductService.normalize(term);
    
    console.log("Input:", cleanInput);
    console.log("Prod1:", cleanProdName1, "Score:", ProductService.calculateScore(cleanInput, cleanProdName1));
    console.log("Prod2:", cleanProdName2, "Score:", ProductService.calculateScore(cleanInput, cleanProdName2));
}

test();
