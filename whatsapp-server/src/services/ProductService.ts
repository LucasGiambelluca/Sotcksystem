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
        const stopWords = ['que', 'tenes', 'tiene', 'hay', 'donde', 'como', 'para', 'una', 'con', 'del', 'los', 'las', 'por', 'favor', 'poneme', 'sumame', 'anotame', 'anota', 'mandame', 'traeme', 'agregame', 'queria', 'querría', 'quisiera', 'porfa', 'puedo', 'podes'];
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

        console.log(`[ProductService] Search "${searchTerm}" -> Best Match in catalog: "${bestMatch?.name}" (Score: ${maxScore})`);

        if (maxScore < 0.6) {
             // Try searching in promotions as fallback
             try {
                const promos = await this.getPromotions();
                let bestPromoMatch = null;
                let maxPromoScore = 0;
                
                for (const promo of promos) {
                    const cleanPromoTitle = this.normalize(promo.title);
                    const score = this.calculateScore(cleanTerm, cleanPromoTitle);
                    if (score > maxPromoScore) {
                        maxPromoScore = score;
                        bestPromoMatch = promo;
                    }
                }
                
                if (maxPromoScore > 0.6 && bestPromoMatch?.catalog_item) {
                    console.log(`[ProductService] Found match in promotions: "${bestPromoMatch.title}" -> "${bestPromoMatch.catalog_item.name}"`);
                    return bestPromoMatch.catalog_item as Product;
                }
             } catch (e) {
                console.error('[ProductService] Promo search failed:', e);
             }
        }

        // Threshold for acceptance (0-1 range)
        return maxScore >= 0.4 ? bestMatch : null;
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

    async getPromotions(): Promise<any[]> {
        const { supabase } = require('../config/database');
        const { data, error } = await supabase
            .from('catalog_promotions')
            .select('*, catalog_item:catalog_items(*)')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        
        if (error) {
            console.error('[ProductService] Error fetching promotions:', error);
            return [];
        }
        return data || [];
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
            
        // Expand abbreviations and lunfardo argentino
        str = str.replace(/\bdoc\.?\s*emp\.?/g, 'docena empanadas')
                 .replace(/\bemp\.?\b/g, 'empanada')
                 .replace(/\bempanaditas\b/g, 'empanada')
                 .replace(/\bempanadas\s+de\b/g, 'empanada')
                 .replace(/\bjyq\b/g, 'jamon y queso')
                 .replace(/\bj y q\b/g, 'jamon y queso')
                 .replace(/\bnapo\b/g, 'napolitana')
                 .replace(/\bmuzza\b/g, 'muzzarella')
                 .replace(/\bfugaz\b/g, 'fugazzetta')
                 .replace(/\bmila\b/g, 'milanesa')
                 .replace(/\broque\b/g, 'roquefort')
                 .replace(/\bpostres\b/g, 'postre')
                 .replace(/\bgaseosas\b/g, 'bebida')
                 .replace(/\bbebidas\b/g, 'bebida')
                 .replace(/\bfritas\b/g, 'papas fritas')
                 .replace(/\bpromo\b/g, '')
                 .replace(/\bpromocion\b/g, '')
                 // Lunfardo argentino extendido
                 .replace(/\bparri\b/g, 'parrilla')
                 .replace(/\bparilla\b/g, 'parrilla') // Typo comun
                 .replace(/\bchori\b/g, 'chorizo')
                 .replace(/\bchoris\b/g, 'chorizo')
                 .replace(/\bchoripa?n\b/g, 'choripan')
                 .replace(/\bvacio\b/g, 'vacio')
                 .replace(/\basadito\b/g, 'asado')
                 .replace(/\bmatambre\b/g, 'matambre')
                 .replace(/\blechon\b/g, 'lechon')
                 .replace(/\bsambuche\b/g, 'sandwich')
                 .replace(/\bsanguchito\b/g, 'sandwich')
                 .replace(/\bsanguche\b/g, 'sandwich')
                 .replace(/\blomito\b/g, 'lomo')
                 .replace(/\bmilas\b/g, 'milanesa')
                 .replace(/\bmilanesas\b/g, 'milanesa')
                 .replace(/\bsupremas?\b/g, 'suprema')
                 .replace(/\bpatas?\s*muslo\b/g, 'pata muslo')
                 .replace(/\bpapitas\b/g, 'papas fritas')
                 .replace(/\bensaladita\b/g, 'ensalada')
                 .replace(/\bguarnicion\b/g, 'guarnicion');
                 
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

                if (normPt.startsWith(token) || token.startsWith(normPt)) return 0.8; // Prefix match (bidirectional)
                
                // Fuzzy match: adaptive tolerance based on word length
                const maxDist = token.length > 6 ? 2 : (token.length > 4 ? 1 : 0);
                if (maxDist > 0 && this.levenshteinDistance(token, normPt) <= maxDist) return 0.7;
                
                // Partial containment ("pollo" inside "pollo a la parrilla")
                if (token.length >= 4 && (normPt.includes(token) || token.includes(normPt))) return 0.6;
                return 0;
            }));
            matchCount += bestTokenScore;
        }

        let score = termTokens.length > 0 ? matchCount / termTokens.length : 0;
        
        // Length penalty: if search term is a tiny fraction of the product name, penalize it
        if (productTokens.length > 0) {
            const coverage = termTokens.length / productTokens.length;
            if (coverage <= 0.5) {
                // Exemption for known food keywords and brands
                const foodKeywords = ['coca', 'sprite', 'pepsi', 'fanta', 'cerveza', 'agua', 'vino', 'pollo', 'parrilla', 'milanesa', 'empanada', 'pizza', 'chorizo', 'asado', 'papas', 'ensalada', 'lomo', 'suprema', 'hamburguesa', 'sandwich'];
                if (termTokens.length === 1 && foodKeywords.includes(termTokens[0])) {
                    score *= 0.75; // Softer penalty for food terms — they're likely intentional
                } else if (termTokens.length === 1) {
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
