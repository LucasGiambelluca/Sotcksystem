const fs = require('fs');
const path = require('path');

try {
    const htmlPath = path.join(__dirname, '..', 'client', 'public', 'El Pollo Comilon a Domicilio ¡Pide Delivery! _ PedidosYa.html');
    const content = fs.readFileSync(htmlPath, 'utf8');
    
    // Find a known product
    const idx1 = content.indexOf('Vacío parrilla con guarnicion');
    const idx2 = content.indexOf('Canelones con salsa');
    
    let res = '';
    if (idx1 !== -1) res += "=== Vacío ===\n" + content.substring(Math.max(0, idx1 - 600), idx1 + 600) + "\n\n";
    if (idx2 !== -1) res += "=== Canelones ===\n" + content.substring(Math.max(0, idx2 - 600), idx2 + 600) + "\n\n";
    
    fs.writeFileSync('dom_inspect.txt', res);
    console.log('Inspection file written.');
} catch (e) {
    console.error(e);
}
