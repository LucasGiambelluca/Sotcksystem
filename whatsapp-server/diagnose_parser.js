
const Parser = require('./src/core/parser');

const text = "quiero 1 pollo con papas y 1 coca";
console.log('Testing text:', text);

const catalogItems = Parser.parseCatalogOrder(text);
console.log('Catalog Items:', JSON.stringify(catalogItems, null, 2));

const catalogCheckout = Parser.parseCatalogCheckout(text);
console.log('Catalog Checkout:', JSON.stringify(catalogCheckout, null, 2));
