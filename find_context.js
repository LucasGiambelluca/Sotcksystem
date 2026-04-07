const fs = require('fs');

const filePath = 'c:\\Users\\Lucas\\Desktop\\Sotcksystem\\Rotiseria El Delirio a Domicilio ¡Pide Delivery! _ PedidosYa.html';

try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8');
    
    console.log('Total content length:', content.length);
    
    const searchString = 'delirio';
    let index = content.toLowerCase().indexOf(searchString);
    if (index !== -1) {
        console.log(`Found "${searchString}" at index ${index}`);
        // Log characters around the index
        console.log('Context:', content.substring(Math.max(0, index - 100), Math.min(content.length, index + 500)));
    } else {
        console.log(`Could not find "${searchString}" in the content.`);
    }

    const empanadaString = 'empanada';
    index = content.toLowerCase().indexOf(empanadaString);
    if (index !== -1) {
        console.log(`Found "${empanadaString}" at index ${index}`);
        console.log('Context:', content.substring(Math.max(0, index - 100), Math.min(content.length, index + 500)));
    }

} catch (err) {
    console.error('Error:', err);
}
