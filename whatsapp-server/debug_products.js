const { supabase } = require('./src/config/database');

class ProductService {
    async getProducts() {
        console.log("Fetching products...");
        const { data, error } = await supabase
            .from('products')
            .select('*');
            
        if (error) {
            console.error("Error fetching products:", error);
            return [];
        }
        console.log(`Fetched ${data?.length} products.`);
        return data || [];
    }

    normalize(text) {
        return text.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\w\s]/g, ""); 
    }

    calculateScore(term, productName) {
        if (productName.includes(term)) return 0.9;
        if (term.includes(productName)) return 0.9;

        const termTokens = term.split(/\s+/).filter(w => w.length > 2 && !['de', 'con', 'las', 'los'].includes(w));
        const productTokens = productName.split(/\s+/);
        
        let matchCount = 0;
        for (const token of termTokens) {
            const bestTokenScore = Math.max(...productTokens.map(pt => {
                if (pt.startsWith(token)) return 0.8;
                if (this.levenshteinDistance(token, pt) <= 1) return 0.7;
                return 0;
            }));
            matchCount += bestTokenScore;
        }

        return termTokens.length > 0 ? matchCount / termTokens.length : 0;
    }

    levenshteinDistance(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
        for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }
    
    async testMatch(term, products) {
        console.log(`\nTesting term: "${term}"`);
        const cleanTerm = this.normalize(term);
        let bestMatch = null;
        let maxScore = 0;

        for (const product of products) {
            const cleanName = this.normalize(product.name);
            const score = this.calculateScore(cleanTerm, cleanName);
            console.log(`  - vs "${product.name}" (${cleanName}): ${score.toFixed(2)}`);
            
            if (score > maxScore) {
                maxScore = score;
                bestMatch = product;
            }
        }
        console.log(`Result: ${bestMatch ? bestMatch.name : 'NULL'} (Score: ${maxScore})`);
    }
}

(async () => {
    require('dotenv').config();
    const service = new ProductService();
    const products = await service.getProducts();
    
    if (products.length === 0) {
        console.log("No products found! Check Database or RLS.");
    } else {
        await service.testMatch("coca", products);
        await service.testMatch("pizza de muccarella", products);
        await service.testMatch("hamburguesa clasica", products);
    }
})();
