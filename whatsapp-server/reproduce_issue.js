const Parser = require('./src/core/parser');

// Mock ProductService
const mockProducts = [
    { id: 1, name: 'Hamburguesa Clásica', price: 500, stock: 100, category: 'Food' },
    { id: 2, name: 'Hamburguesa Doble', price: 700, stock: 100, category: 'Food' },
    { id: 3, name: 'Pizza Muzzarella', price: 800, stock: 100, category: 'Food' },
    { id: 4, name: 'Pizza Especial', price: 1000, stock: 100, category: 'Food' },
    { id: 5, name: 'Papas Fritas', price: 300, stock: 100, category: 'Food' },
    { id: 6, name: 'Coca Cola / Sprite', price: 200, stock: 100, category: 'Drinks' }
];

async function findProduct(searchTerm) {
    const term = searchTerm.toLowerCase();
    // Simulate ILIKE %term%
    return mockProducts.find(p => p.name.toLowerCase().includes(term));
}

// Test Cases
const inputs = [
    "2 hamburguesas clasicas 1 coca",
    "1 pizza de muccarella y 1 coca cola",
    "1 pizza de muzzarella"
];

console.log("--- Reproduction Test ---\n");

(async () => {
    for (const input of inputs) {
        console.log(`Input: "${input}"`);
        const items = Parser.parse(input);
        console.log("Parsed Items:", items);
        
        const found = [];
        const notFound = [];
        
        for (const item of items) {
            const product = await findProduct(item.product);
            if (product) {
                found.push({ ...item, matched: product.name });
            } else {
                notFound.push(item.product);
            }
        }
        
        console.log("Found:", found);
        console.log("Not Found:", notFound);
        console.log("---------------------------------------------------\n");
    }
})();
