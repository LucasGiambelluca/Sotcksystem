import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import { productService } from '../../services/ProductService';

export interface ExtractedEntity {
    type: 'product' | 'quantity' | 'modifier' | 'question_type' | 'category';
    value: string;
    normalizedValue: string;
    confidence: number;
    position: [number, number];
    metadata?: any;
}

export class EntityExtractor {
    private productCatalog: Map<string, any> = new Map();
    private db: any;

    constructor(dbClient?: any) {
        this.db = dbClient || supabase;
    }

    /**
     * Loads products and synonyms from database to build the lookup index
     */
    async loadCatalog(): Promise<void> {
        try {
            // First try with synonyms, if it fails, try without
            let { data: products, error } = await this.db
                .from('catalog_items')
                .select('id, name, synonyms, price, category, is_active');

            if (error && error.message?.includes('synonyms')) {
                console.warn('[NLU] synonyms column missing, retrying without it');
                const result = await this.db
                    .from('catalog_items')
                    .select('id, name, price, category, is_active');
                products = result.data;
                error = result.error;
            }

            if (error) throw error;

            const activeProducts = products?.filter((p: any) => p.is_active) || [];
            this.productCatalog.clear();
            const categories = new Set<string>();
            
            for (const product of activeProducts) {
                // Main name
                this.indexProduct(product.name.toLowerCase(), product);
                if (product.category) categories.add(product.category.toLowerCase());
                
                // Synonyms
                if (product.synonyms && Array.isArray(product.synonyms)) {
                    for (const syn of product.synonyms) {
                        this.indexProduct(syn.toLowerCase(), product, true);
                    }
                }
            }

            // Index categories as separate entities
            for (const cat of categories) {
                this.productCatalog.set(cat, { type: 'category', name: cat, confidence: 0.9 });
            }
            logger.info(`[NLU] Catalog bootstrap: ${activeProducts.length} active products found. ${this.productCatalog.size} terms indexed.`);
            if (activeProducts.length === 0 && products && products.length > 0) {
                logger.warn(`[NLU] Warning: Found ${products.length} total products but 0 ARE ACTIVE. NLU matching will fail.`);
            }
        } catch (err: any) {
            logger.error(`[NLU] Failed to load catalog`, { error: err.message });
        }
    }

    private indexProduct(key: string, product: any, isSynonym = false): void {
        this.productCatalog.set(key, {
            productId: product.id,
            productName: product.name,
            basePrice: product.price,
            category: product.category,
            confidence: isSynonym ? 0.95 : 1.0
        });
    }

    /**
     * Extracts entities from raw text (Async version to use ProductService)
     */
    async extract(text: string): Promise<ExtractedEntity[]> {
        const normalized = this.normalizeText(text);
        const entities: ExtractedEntity[] = [];

        // 1. Quantities (Sync) - extracted FIRST so products can avoid quantity tokens
        const quantityEntities = this.extractQuantities(normalized);
        entities.push(...quantityEntities);

        // 2. Products (Async) - skip tokens already covered by quantities
        const quantityRanges = quantityEntities.map(e => e.position as [number, number]);
        const productEntities = await this.extractProducts(normalized, quantityRanges);
        entities.push(...productEntities);

        return this.resolveConflicts(entities);
    }

    private normalizeText(text: string): string {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^\w\s]/g, ' ') // Only alphanumeric
            .replace(/\s+/g, ' ')
            .trim();
    }

    private extractQuantities(text: string): ExtractedEntity[] {
        const entities: ExtractedEntity[] = [];

        // Compound quantity phrases first (media docena, etc.)
        const compoundPatterns: Array<{ regex: RegExp; value: number }> = [
            { regex: /\bmedia\s+docena\b/gi, value: 6 },
            { regex: /\b(\d+)\s+docenas?\b/gi, value: -1 }, // special: multiply by 12
            { regex: /\buna?\s+docena\b/gi, value: 12 },
            { regex: /\bdocena\b/gi, value: 12 },
        ];
        
        const coveredRanges: Array<[number, number]> = [];
        
        for (const pattern of compoundPatterns) {
            let match;
            while ((match = pattern.regex.exec(text)) !== null) {
                const start = match.index;
                const end = match.index + match[0].length;
                
                // Skip if this range overlaps with an already covered range
                const overlaps = coveredRanges.some(([s, e]) => !(end <= s || start >= e));
                if (overlaps) continue;
                
                let value = pattern.value;
                if (value === -1) {
                    // N docenas → N * 12
                    value = parseInt(match[1]) * 12;
                }
                
                entities.push({
                    type: 'quantity',
                    value: match[0],
                    normalizedValue: String(value),
                    confidence: 1.0,
                    position: [start, end]
                });
                coveredRanges.push([start, end]);
            }
        }

        const numberWords: Record<string, number> = {
            'un': 1, 'una': 1, 'uno': 1,
            'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
            'media': 0.5, 'medio': 0.5, 'mitad': 0.5
        };

        // Number words
        for (const [word, value] of Object.entries(numberWords)) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            let match;
            while ((match = regex.exec(text)) !== null) {
                const start = match.index;
                const end = match.index + match[0].length;
                const overlaps = coveredRanges.some(([s, e]) => !(end <= s || start >= e));
                if (overlaps) continue;
                
                entities.push({
                    type: 'quantity',
                    value: word,
                    normalizedValue: String(value),
                    confidence: 0.9,
                    position: [start, end]
                });
                coveredRanges.push([start, end]);
            }
        }

        // Digits
        const digitRegex = /\b(\d+(?:[.,]\d+)?)\b/g;
        let match;
        while ((match = digitRegex.exec(text)) !== null) {
            const start = match.index;
            const end = match.index + match[0].length;
            const overlaps = coveredRanges.some(([s, e]) => !(end <= s || start >= e));
            if (overlaps) continue;
            
            entities.push({
                type: 'quantity',
                value: match[1],
                normalizedValue: match[1].replace(',', '.'),
                confidence: 1.0,
                position: [start, end]
            });
            coveredRanges.push([start, end]);
        }

        return entities;
    }

    private async extractProducts(text: string, quantityRanges: Array<[number, number]> = []): Promise<ExtractedEntity[]> {
        const entities: ExtractedEntity[] = [];
        const tokens = text.split(' ');

        // Build a set of character positions covered by quantity entities
        const isQuantityPos = (start: number, end: number) => {
            return quantityRanges.some(([qs, qe]) => !(end <= qs || start >= qe));
        };

        // Try N-grams from 6 down to 1 (increased for '1 docena de empanadas de carne')
        for (let n = Math.min(6, tokens.length); n >= 1; n--) {
            for (let i = 0; i <= tokens.length - n; i++) {
                const phrase = tokens.slice(i, i + n).join(' ');
                const phraseStart = text.indexOf(phrase);
                const phraseEnd = phraseStart + phrase.length;
                
                // Skip if this phrase starts inside a quantity range
                if (isQuantityPos(phraseStart, phraseEnd) && n <= 2) continue;
                
                // Skip noise words (quantities, articles, verbs)
                if (n === 1 && (phrase.length < 3 || ['y', 'con', 'para', 'una', 'un', 'uno', 'del', 'los', 'las', 'quiero', 'mandame', 'dame', 'docena', 'docenas', 'media', 'medio', 'poneme', 'sumame', 'anotame', 'traeme', 'agregame', 'porfa'].includes(phrase))) continue;

                // 1. Prioritize EXACT Category match (e.g. "empanadas")
                const localMatch = this.productCatalog.get(phrase.toLowerCase());
                if (localMatch && localMatch.type === 'category') {
                    entities.push({
                        type: 'category',
                        value: phrase,
                        normalizedValue: localMatch.name,
                        confidence: 0.95,
                        position: [text.indexOf(phrase), text.indexOf(phrase) + phrase.length]
                    });
                    continue; // Skip product check if we have a category match
                }

                // 2. Use ProductService for smart matching
                const matchResult = await productService.findProductWithScore(phrase);

                if (matchResult) {
                    const { product, score } = matchResult;
                    entities.push({
                        type: 'product',
                        value: phrase,
                        normalizedValue: product.name,
                        confidence: score,
                        position: [text.indexOf(phrase), text.indexOf(phrase) + phrase.length],
                        metadata: {
                            productId: product.id,
                            productName: product.name,
                            basePrice: product.price,
                            category: product.category,
                            stock: product.stock
                        }
                    });
                }
            }
        }
        return entities;
    }

    private fuzzySearch(word: string): any | null {
        for (const [key, data] of this.productCatalog) {
            if (key.length < 4) continue;
            const dist = this.levenshtein(word, key);
            if (dist <= 1 || (word.length > 6 && dist <= 2)) {
                return data;
            }
        }
        return null;
    }

    private levenshtein(a: string, b: string): number {
        const tmp = [];
        for (let i = 0; i <= a.length; i++) tmp[i] = [i];
        for (let j = 0; j <= b.length; j++) tmp[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                tmp[i][j] = Math.min(
                    tmp[i - 1][j] + 1,
                    tmp[i][j - 1] + 1,
                    tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                );
            }
        }
        return tmp[a.length][b.length];
    }

    private resolveConflicts(entities: ExtractedEntity[]): ExtractedEntity[] {
        // Sort: quantities first (always keep), then by confidence desc, then by length desc
        entities.sort((a, b) => {
            // Quantities always win over products/categories
            if (a.type === 'quantity' && b.type !== 'quantity') return -1;
            if (a.type !== 'quantity' && b.type === 'quantity') return 1;
            
            if (Math.abs(b.confidence - a.confidence) > 0.05) {
                return b.confidence - a.confidence;
            }
            return (b.position[1] - b.position[0]) - (a.position[1] - a.position[0]);
        });
        
        const result: ExtractedEntity[] = [];
        for (const entity of entities) {
            const overlaps = result.some(r => 
                !(entity.position[1] <= r.position[0] || entity.position[0] >= r.position[1])
            );
            if (!overlaps) result.push(entity);
        }
        return result.sort((a, b) => a.position[0] - b.position[0]);
    }
}
