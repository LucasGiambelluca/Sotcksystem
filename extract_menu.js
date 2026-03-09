const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'client', 'public', 'El Pollo Comilon a Domicilio ¡Pide Delivery! _ PedidosYa.html');
const content = fs.readFileSync(htmlPath, 'utf8');

// The state in PedidosYa is typically injected like this:
// window.__INITIAL_STATE__ = { ... };
const match = content.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});<\/script>/s);

if (match) {
    try {
        const state = JSON.parse(match[1]);
        fs.writeFileSync(path.join(__dirname, 'pedidosya_raw.json'), JSON.stringify(state, null, 2));
        console.log('✅ Found and extracted __INITIAL_STATE__ successfully.');
    } catch (e) {
        console.error('❌ Error parsing JSON:', e.message);
    }
} else {
    console.log('❌ window.__INITIAL_STATE__ not found. Attempting alternative regex...');
    
    // Alternative: sometimes it's window.__DATA__ or similar
    const altMatch = content.match(/window\.__data\s*=\s*(\{.*?\});/s);
    if (altMatch) {
       fs.writeFileSync(path.join(__dirname, 'pedidosya_raw.json'), altMatch[1]);
       console.log('✅ Found alternative __data match.');
    } else {
       console.log('❌ Could not find any JSON state in the HTML.');
       
       // Dump script tags for manual inspection
       const scripts = [...content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
       const scriptContents = scripts.map(s => s[1].substring(0, 100)).filter(s => s.includes('window.'));
       console.log('Script tags containing window: ', scriptContents);
    }
}
