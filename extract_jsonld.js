const fs = require('fs');

const filePath = 'c:\\Users\\Lucas\\Desktop\\Sotcksystem\\Rotiseria El Delirio a Domicilio ¡Pide Delivery! _ PedidosYa.html';

try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8');
    
    // Look for the start of the JSON-LD
    const searchString = '{"@context":"http://schema.org"';
    let startIndex = content.indexOf(searchString);
    if (startIndex === -1) {
        // Try another variation
        startIndex = content.indexOf('"@type":"Restaurant"');
        // Backtrack to the nearest {
        while (startIndex > 0 && content[startIndex] !== '{') {
            startIndex--;
        }
    }

    if (startIndex !== -1) {
        console.log(`Found JSON-LD start at index ${startIndex}`);
        
        // Find the end of this JSON block
        let openBraces = 0;
        let endIndex = -1;
        for (let i = startIndex; i < content.length; i++) {
            if (content[i] === '{') openBraces++;
            else if (content[i] === '}') {
                openBraces--;
                if (openBraces === 0) {
                    endIndex = i;
                    break;
                }
            }
        }

        if (endIndex !== -1) {
            const jsonStr = content.substring(startIndex, endIndex + 1);
            fs.writeFileSync('extracted_menu.json', jsonStr);
            console.log('Saved JSON-LD to extracted_menu.json');
        } else {
            console.log('Could not find end of JSON-LD');
        }
    } else {
        console.log('Could not find JSON-LD start');
        
        // Manual search for MenuItem objects
        const regex = /\{"@type":"MenuItem",.*?\}/g;
        const matches = content.match(regex);
        if (matches) {
            console.log(`Found ${matches.length} individual MenuItem strings.`);
            fs.writeFileSync('individual_items.json', JSON.stringify(matches));
        }
    }

} catch (err) {
    console.error('Error:', err);
}
