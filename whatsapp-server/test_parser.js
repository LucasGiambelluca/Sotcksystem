const Parser = require('./src/core/parser');

const text = `Nombre: Carlos | Delivery: Retiro en local | Pago: Transferencia / ...
♦ ¡Hola! Quiero hacer el siguiente pedido:

• 1 kg de arrollado de pollo x1 - $30.887

Total: $30.887`;

console.log('Testing parseCatalogCheckout:');
const result = Parser.parseCatalogCheckout(text);
console.log(JSON.stringify(result, null, 2));

console.log('Testing parseCatalogOrder:');
const items = Parser.parseCatalogOrder(text);
console.log(JSON.stringify(items, null, 2));
