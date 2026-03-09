const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'client', 'public', 'El Pollo Comilon a Domicilio ¡Pide Delivery! _ PedidosYa.html');
const content = fs.readFileSync(htmlPath, 'utf8');

const menuItems = [];

// En PedidosYa el HTML suele tener los items envueltos en atributos específicos o clases predecibles.
// Vamos a buscar patrones usando Regex 

// Buscar nombres de productos. Suelen estar en <h3 class="name...", <h3 itemprop="name" o spans
const itemRegex = /<li[^>]*data-test-id="product-item"[^>]*>([\s\S]*?)<\/li>/gi;
let match;
while ((match = itemRegex.exec(content)) !== null) {
    const itemHtml = match[1];
    
    // Titulo
    const titleMatch = itemHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || itemHtml.match(/itemprop="name"[^>]*>([\s\S]*?)<\/span>/);
    let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    
    // Descripcion
    const descMatch = itemHtml.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/) || itemHtml.match(/itemprop="description"[^>]*>([\s\S]*?)<\/p>/);
    let desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    // Precio
    const priceMatch = itemHtml.match(/\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/);
    let priceText = priceMatch ? priceMatch[0] : '';

    // Image URL
    const imgMatch = itemHtml.match(/<img[^>]*src="([^"]+)"/) || itemHtml.match(/<source[^>]*srcset="([^"]+)"/);
    let img = imgMatch ? imgMatch[1] : '';

    if (title) {
        menuItems.push({
             name: title,
             description: desc,
             price: priceText,
             image: img.split(' ')[0] // In case of standard srcset split
        });
    }
}

if (menuItems.length > 0) {
    console.log(`✅ Extracted ${menuItems.length} items using rigorous regex.`);
    fs.writeFileSync(path.join(__dirname, 'pedidosya_scraped.json'), JSON.stringify(menuItems, null, 2));
} else {
    console.log('❌ Rigorous regex failed to find items. Falling back to generic search...');
    
    // Fallback genérico: Buscar todas las apariciones de "pollo" e intentar deducir la estructura.
    const allH3s = [...content.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)];
    const sampleH3s = allH3s.map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(t => t.toLowerCase().includes('pollo')).slice(0, 5);
    console.log('Sample H3 tags with "pollo":', sampleH3s);
}
