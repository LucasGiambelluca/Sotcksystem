import { IProductRepository, Product } from '../domain/interfaces/IProductRepository';
import { productRepository } from '../infrastructure/database/repositories';

class ProductService {
    private repository: IProductRepository;
    private productsCache: Product[] | null = null;
    private cacheTimestamp: number = 0;
    private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor(repository: IProductRepository) {
        this.repository = repository;
    }

    async getProducts(): Promise<Product[]> {
        // Only fetch products with stock > 0
        const products = await this.repository.getAll();
        return products.filter(p => p.stock > 0).sort((a, b) => {
            return (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name);
        });
    }

    async findProduct(searchTerm: string): Promise<Product | null> {
        const now = Date.now();
        if (!this.productsCache || (now - this.cacheTimestamp > this.CACHE_TTL)) {
            this.productsCache = await this.repository.getAll();
            this.cacheTimestamp = now;
        }
        
        const products = this.productsCache;
        
        console.log(`[ProductService] findProduct: Term="${searchTerm}". Total loaded products: ${products.length}`);
        
        // Search ALL products regardless of stock — stock validation happens at order creation
        if (products.length === 0) return null;

        // 0. Check for exact ID match first
        const exactIdMatch = products.find(p => p.id === searchTerm);
        if (exactIdMatch) {
            console.log(`[ProductService] Exact ID Match found for "${searchTerm}" -> "${exactIdMatch.name}"`);
            return exactIdMatch;
        }

        const cleanTerm = this.normalize(searchTerm);
        const stopWords = ['que', 'tenes', 'tiene', 'hay', 'donde', 'como', 'para', 'una', 'con', 'del', 'los', 'las', 'por', 'favor'];
        if (cleanTerm.length < 3 || stopWords.includes(cleanTerm)) {
            console.log(`[ProductService] Ignoring stop word or short term: "${cleanTerm}"`);
            return null;
        }
        console.log(`[ProductService] Normalized term: "${cleanTerm}"`);
        
        let bestMatch: Product | null = null;
        let maxScore = 0;

        for (const product of products) {
            const cleanProdName = this.normalize(product.name);
            
            // 1. Exact match bypass (only for full exact match)
            if (cleanProdName === cleanTerm) {
                console.log(`[ProductService] Exact Match found for "${searchTerm}" -> "${product.name}"`);
                return product; 
            }

            const score = this.calculateScore(cleanTerm, cleanProdName);
            if (score > maxScore) {
                maxScore = score;
                bestMatch = product;
            }
        }

        console.log(`[ProductService] Search "${searchTerm}" -> Best Match: "${bestMatch?.name}" (Score: ${maxScore})`);

        // Threshold for acceptance (0-1 range)
        return maxScore > 0.4 ? bestMatch : null;
    }

    async findProductWithScore(searchTerm: string): Promise<{ product: Product, score: number } | null> {
        const product = await this.findProduct(searchTerm);
        if (!product) return null;
        
        const cleanTerm = this.normalize(searchTerm);
        const cleanProdName = this.normalize(product.name);
        
        // Emulate exact match score bypass
        if (cleanProdName === cleanTerm) {
            return { product, score: 1.0 };
        }
        
        const score = this.calculateScore(cleanTerm, cleanProdName);
        return { product, score };
    }

    async findProductsByCategory(category: string): Promise<Product[]> {
        const products = await this.getProducts();
        const cleanCat = this.normalize(category);
        return products.filter(p => p.category && this.normalize(p.category).includes(cleanCat));
    }

    async findCategories(): Promise<string[]> {
        const products = await this.getProducts();
        const categories = new Set<string>();
        products.forEach(p => { if (p.category) categories.add(p.category); });
        return Array.from(categories);
    }

    getEffectivePrice(product: Product): number {
        if (product.is_special && typeof product.special_price === 'number') {
            return product.special_price;
        }
        return product.price;
    }

    async massPriceUpdate(percentage: number): Promise<void> {
        const { supabase } = require('../config/database');
        const { error } = await supabase.rpc('update_all_catalog_prices', { p_percentage: percentage });
        if (error) throw new Error(`Mass price update failed: ${error.message}`);
    }

    async toggleSpecial(id: string, isSpecial: boolean, specialPrice?: number, label?: string): Promise<void> {
        const { supabase } = require('../config/database');
        const { error } = await supabase.rpc('toggle_catalog_special', {
            p_id: id,
            p_is_special: isSpecial,
            p_special_price: specialPrice,
            p_label: label
        });
        if (error) throw new Error(`Toggle special failed: ${error.message}`);
    }


    private normalize(text: string): string {
        let str = text.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
        // Expand abbreviations found in catalog names to full words
        str = str.replace(/\bdoc\.?\s*emp\.?/g, 'docena empanadas')
                 .replace(/\bemp\.?\b/g, 'empanada')
                 .replace(/\bjyq\b/g, 'jamon y queso')
                 .replace(/\bj y q\b/g, 'jamon y queso')
                 .replace(/\bnapo\b/g, 'napolitana')
                 .replace(/\bmuzza\b/g, 'muzzarella')
                 .replace(/\bfugaz\b/g, 'fugazzetta')
                 .replace(/\bmila\b/g, 'milanesa')
                 .replace(/\broque\b/g, 'roquefort')
                 .replace(/\bfritas\b/g, 'papas fritas');
                 
        return str.replace(/[^\w\s\d\/]/g, " ").replace(/\s+/g, " ").trim();
    }

    private calculateScore(term: string, productName: string): number {
        // 2. Token overlap & Levenshtein
        const stopWords = ['de', 'con', 'las', 'los', 'a', 'la', 'el', 'en', 'y'];
        const termTokens = term.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
        const productTokens = productName.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
        
        let matchCount = 0;
        for (const token of termTokens) {
            // Find best matching token in product
            const bestTokenScore = Math.max(...productTokens.map(pt => {
                const normPt = this.normalize(pt);
                if (normPt === token) return 1.0;
                
                // Synonyms
                if ((token === 'papas' && normPt === 'fritas') || (token === 'fritas' && normPt === 'papas')) return 0.9;
                if ((token === 'coca' && normPt.includes('coca')) || (token === 'sprite' && normPt.includes('sprite'))) return 0.9;

                if (normPt.startsWith(token)) return 0.8; // Prefix match
                
                // Fuzzy match: only for words longer than 4 chars
                if (token.length > 4 && this.levenshteinDistance(token, normPt) <= 1) return 0.7;
                return 0;
            }));
            matchCount += bestTokenScore;
        }

        let score = termTokens.length > 0 ? matchCount / termTokens.length : 0;
        
        // Length penalty: if search term is a tiny fraction of the product name, penalize it
        if (productTokens.length > 0) {
            const coverage = termTokens.length / productTokens.length;
            if (coverage <= 0.5) {
                // Exemption for generic brands to allow partial matches to surface
                if (termTokens.length === 1 && ['coca', 'sprite', 'pepsi', 'fanta', 'cerveza', 'agua', 'vino'].includes(termTokens[0])) {
                    score *= 0.85;
                } else if (termTokens.length === 1) {
                    // Stricter penalty for single-word generic terms like 'pollo' matching 'milanesa de pollo'
                    score *= 0.5; 
                } else {
                    score *= (coverage * 1.5); 
                }
            }
        }
        
        return score;
    }

    async searchSimilarProducts(term: string): Promise<Product[]> {
        const products = await this.getProducts();
        const cleanTerm = this.normalize(term);
        
        const scored = products.map(p => {
            const cleanProdName = this.normalize(p.name);
            const score = this.calculateScore(cleanTerm, cleanProdName);
            return { p, score };
        });

        // Filter high scores and sort descending
        return scored
            .filter(s => s.score > 0.4)
            .sort((a, b) => b.score - a.score)
            .map(s => s.p)
            .slice(0, 3); // top 3 options
    }

    private levenshteinDistance(a: string, b: string): number {
        const matrix: number[][] = [];
        for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
        for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
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
}

// Export a singleton instance injecting the actual repository implementation
export const productService = new ProductService(productRepository);
export default productService;
