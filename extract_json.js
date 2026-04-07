const fs = require('fs');

const filePath = 'c:\\Users\\Lucas\\Desktop\\Sotcksystem\\Rotiseria El Delirio a Domicilio ¡Pide Delivery! _ PedidosYa.html';

try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Attempt to find a large JSON object that contains the menu
    // We look for patterns like {"id":...,"name":"...", "price":...}
    
    // Let's try to find potential JSON start/end positions
    const regex = /\{"id":\d+,"name":".*?","price":\d+/g;
    let match;
    const matches = [];
    while ((match = regex.exec(content)) !== null) {
        matches.push(match);
    }
    
    console.log(`Found ${matches.length} potential product matches.`);
    
    // Find the largest JSON block
    // Often it's in a script tag
    const scriptTags = content.match(/<script.*?>([\s\S]*?)<\/script>/g) || [];
    console.log(`Found ${scriptTags.length} script tags.`);
    
    for (let i = 0; i < scriptTags.length; i++) {
        const text = scriptTags[i];
        if (text.includes('"sections"') && text.includes('"products"')) {
            console.log(`Script tag ${i} seems to contain the menu data!`);
            // Extract the JSON content between the first { and the last }
            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = text.substring(jsonStart, jsonEnd + 1);
                fs.writeFileSync('extracted_menu.json', jsonStr);
                console.log('Saved to extracted_menu.json');
                process.exit(0);
            }
        }
    }

    // Fallback: look for ANY large JSON in the file
    const largeJsonMatch = content.match(/\{"props":\{"pageProps":([\s\S]*?\}),"/);
    if (largeJsonMatch) {
        console.log('Found props.pageProps');
        fs.writeFileSync('extracted_menu.json', largeJsonMatch[1]);
        process.exit(0);
    }

    console.log('Could not find menu data.');
} catch (err) {
    console.error('Error:', err);
}
