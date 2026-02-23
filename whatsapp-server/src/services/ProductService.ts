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
        const availableProducts = products.filter(p => p.stock > 0);

        if (availableProducts.length === 0) return null;

        const cleanTerm = this.normalize(searchTerm);
        let bestMatch: Product | null = null;
        let maxScore = 0;

        for (const product of availableProducts) {
            const score = this.calculateScore(cleanTerm, this.normalize(product.name));
            if (score > maxScore) {
                maxScore = score;
                bestMatch = product;
            }
        }

        // Threshold for acceptance (0-1 range)
        return maxScore > 0.4 ? bestMatch : null;
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
