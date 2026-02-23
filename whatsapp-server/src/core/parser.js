class Parser {
    static parse(text) {
        if (!text) return [];
        
        // Normalize: remove accents, lower case
        const normalized = text.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\w\s]/g, " "); // Replace punctuation with space
            
        const items = [];
        const numberMap = { 'un': 1, 'una': 1, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5 };

        // Regex Strategies
        // 1. "2 de hamburguesas", "2 x pizzas"
        // 2. "una coca"
        
        // Pattern: (NumberWord or Digit) + optional "de/x" + (ProductName)
        // We iterate specifically looking for these patterns
        
        // Use a loop with exec
        const regex = /(\d+|un|una|uno|dos|tres|cuatro|cinco)\s*(?:x|de)?\s+([a-z\s]+?)(?=\s+(?:y|e|con|,)\s+|\s+(\d+|un|una|uno|dos|tres|cuatro|cinco)\s+|$)/g;
        
        let match;
        while ((match = regex.exec(normalized)) !== null) {
            let qtyRaw = match[1];
            let productRaw = match[2]; // Captured product name
            
            let qty = 1;
            if (/\d+/.test(qtyRaw)) {
                qty = parseInt(qtyRaw);
            } else {
                qty = numberMap[qtyRaw] || 1;
            }
            
            productRaw = productRaw.trim();
            
            // Filter noise
            if (['quiero', 'dame', 'me', 'das'].includes(productRaw)) continue;
            if (productRaw.length < 3) continue; // "de", "la"
            
            items.push({ qty, product: productRaw });
        }
        
        return items;
    }

    // For "ParseOrder" alias compatibility if preferred
    static parseOrder(text) {
        return this.parse(text);
    }

    /**
     * Detect if a message is a stock/availability inquiry.
     * Examples: "tenes 10 hamburguesas?", "hay papas?", "quedan supremas?"
     * Returns: { qty, product } or null if not a stock inquiry.
     */
    static detectStockInquiry(text) {
        if (!text) return null;

        const normalized = text.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[?¿!¡]/g, "") // Remove question marks
            .trim();

        // Stock inquiry trigger words
        const stockRegex = /^(?:tenes|tienen|tendras|tendran|hay|queda|quedan|tendra|dispon(?:ible|en|es)|te queda|les queda|vas a tener)\s+(.+)$/;
        const match = normalized.match(stockRegex);

        if (!match) return null;

        let rest = match[1].trim();

        // Try to extract quantity from the remaining text
        const numberMap = { 'un': 1, 'una': 1, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10 };
        const qtyRegex = /^(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:de|x)?\s+(.+)$/;
        const qtyMatch = rest.match(qtyRegex);

        let qty = null;
        let product;

        if (qtyMatch) {
            const qtyRaw = qtyMatch[1];
            qty = /\d+/.test(qtyRaw) ? parseInt(qtyRaw) : (numberMap[qtyRaw] || 1);
            product = qtyMatch[2].trim();
        } else {
            // No quantity specified, just asking about the product
            // Remove common filler words at start
            product = rest.replace(/^(?:algo de|algunas?|algun|stock de)\s+/, '').trim();
        }

        // Filter out noise
        if (product.length < 3) return null;

        return { qty, product };
    }
}

module.exports = Parser;
