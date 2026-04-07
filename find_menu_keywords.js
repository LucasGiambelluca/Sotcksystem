const fs = require('fs');

const filePath = 'c:\\Users\\Lucas\\Desktop\\Sotcksystem\\Rotiseria El Delirio a Domicilio ¡Pide Delivery! _ PedidosYa.html';

try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8');
    
    const searchStrings = ['"sections"', '"products"', '"price"', '"categories"'];
    
    for (const s of searchStrings) {
        let index = content.indexOf(s);
        if (index !== -1) {
            console.log(`Found ${s} at index ${index}`);
            console.log('Context:', content.substring(Math.max(0, index - 50), Math.min(content.length, index + 200)));
        } else {
            console.log(`Could not find ${s}`);
        }
    }

} catch (err) {
    console.error('Error:', err);
}
