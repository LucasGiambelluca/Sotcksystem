import { IProductRepository, Product } from '../domain/interfaces/IProductRepository';
import { productRepository } from '../infrastructure/database/repositories';

class ProductService {
    private repository: IProductRepository;

    constructor(repository: IProductRepository) {
        this.repository = repository;
    }

    async getProducts(): Promise<Product[]> {
        // Only fetch products with stock > 0
        const products = await this.repository.getAll();
        return products.filter(p => p.stock > 0).sort((a, b) => {
            if (a.category && b.category) {
                 const catCompare = a.category.localeCompare(b.category);
                 if (catCompare !== 0) return catCompare;
            }
            return a.name.localeCompare(b.name);
        });
    }

    async findProduct(searchTerm: string): Promise<Product | null> {
        const products = await this.repository.getAll();
        
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
        console.log(`[ProductService] Normalized term: "${cleanTerm}"`);
        
        let bestMatch: Product | null = null;
        let maxScore = 0;

        for (const product of products) {
            const cleanProdName = this.normalize(product.name);
            
            // 1. Exact match bypass
            if (cleanProdName === cleanTerm || cleanProdName.includes(cleanTerm)) {
                console.log(`[ProductService] Exact Match found for "${searchTerm}" -> "${product.name}"`);
                return product; // Immediate return for perfect match
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
        return text.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\w\s]/g, ""); // Remove punctuation
    }

    private calculateScore(term: string, productName: string): number {
        // 1. Direct inclusion check (high value)
        if (productName.includes(term)) return 0.9;
        if (term.includes(productName)) return 0.9;

        // 2. Token overlap & Levenshtein
        const termTokens = term.split(/\s+/).filter(w => w.length > 2 && !['de', 'con', 'las', 'los'].includes(w));
        const productTokens = productName.split(/\s+/);
        
        let matchCount = 0;
        for (const token of termTokens) {
            // Find best matching token in product
            const bestTokenScore = Math.max(...productTokens.map(pt => {
                if (pt.startsWith(token)) return 0.8; // Prefix match
                if (this.levenshteinDistance(token, pt) <= 1) return 0.7; // Typo tolerance
                return 0;
            }));
            matchCount += bestTokenScore;
        }

        return termTokens.length > 0 ? matchCount / termTokens.length : 0;
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
