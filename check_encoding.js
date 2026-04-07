const fs = require('fs');

const filePath = 'c:\\Users\\Lucas\\Desktop\\Sotcksystem\\Rotiseria El Delirio a Domicilio ¡Pide Delivery! _ PedidosYa.html';

try {
    const buffer = fs.readFileSync(filePath);
    console.log('Buffer length:', buffer.length);
    console.log('First 20 bytes (hex):', buffer.slice(0, 20).toString('hex'));

    const encodings = ['utf8', 'utf16le', 'latin1'];
    for (const enc of encodings) {
        const content = buffer.toString(enc);
        if (content.toLowerCase().includes('delirio')) {
            console.log(`Found "delirio" in ${enc} encoding!`);
            // Check for some products
            if (content.toLowerCase().includes('empanada')) {
                console.log('Found "empanada" as well.');
                process.exit(0);
            }
        }
    }
    console.log('Could not find restaurant name in any common encoding.');
} catch (err) {
    console.error('Error:', err);
}
