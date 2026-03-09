const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const htmlPath = path.join(__dirname, 'client', 'public', 'El Pollo Comilon a Domicilio ¡Pide Delivery! _ PedidosYa.html');
const content = fs.readFileSync(htmlPath, 'utf8');

const $ = cheerio.load(content);
const menu = [];

// En PedidosYa cada categoría suele estar en una seccion o div con un h2
// Buscaremos posibles contenedores de productos. 
// La estructura típica (2024-2025) tiene sections o articles.
// Vamos a ser genéricos: buscar todos los headings y lo que los sigue.

// Buscamos cualquier script tag tipo json para ver si hay data embebida en schema.org
const ldJson = $('script[type="application/ld+json"]').map((i, el) => $(el).html()).get();
if (ldJson.length > 0) {
    fs.writeFileSync(path.join(__dirname, 'pedidosya_ldjson.json'), JSON.stringify(ldJson, null, 2));
    console.log('✅ Found Schema.org JSON-LD data.');
}

// Intentar extraer del DOM estructurado
// ------------------------------------
console.log('--- Buscando en DOM ---');

// PedidosYa pone a los productos en listas con item prop. Vamos a buscar itemprop="menuItem"
const items = $('[itemprop="menuItem"], .product-item, [data-test-id="product-item"], li article');

console.log(`Found ${items.length} potential product items in DOM.`);

if (items.length > 0) {
    items.each((i, el) => {
        const item = $(el);
        // El nombre suele estar en un h3, span con font-weight, o itemprop="name"
        let name = item.find('[itemprop="name"]').text().trim();
        if (!name) name = item.find('h3').first().text().trim();
        if (!name) name = item.find('p:first-child').text().trim(); // Fallback to first p
        
        let desc = item.find('[itemprop="description"]').text().trim();
        if (!desc) desc = item.find('p.description, p').eq(1).text().trim();
        
        // Precio suele estar agrupado con el símbolo $
        let priceText = item.find(':contains("$")').last().text().trim() || item.text().match(/\$\s*[\d.]+/)?.[0];
        
        let imgUrl = item.find('picture img').attr('src') || item.find('img').attr('src');
        if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('data:image')) {
             imgUrl = item.find('picture source').attr('srcset')?.split(' ')[0] || imgUrl;
        }

        console.log(`* ${name} | ${priceText}`);
        menu.push({ name, description: desc, price: priceText, image: imgUrl });
    });
    
    fs.writeFileSync(path.join(__dirname, 'pedidosya_scraped.json'), JSON.stringify(menu, null, 2));
} else {
    // Buscar la palabra "Pollos" o "Menu" y volcar divs cercanos para debuggear la estructura.
    console.log("No standard elements found. Dumping some classes to see structure...");
    $('div').each((i, el) => {
        const text = $(el).text();
        if (text.includes("Pollo") && $(el).attr('class')) {
            console.log("Found Pollo in class:", $(el).attr('class'), "length:", text.length);
        }
    });

}
