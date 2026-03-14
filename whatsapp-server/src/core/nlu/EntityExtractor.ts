import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

export interface ExtractedEntity {
    type: 'product' | 'quantity' | 'modifier' | 'question_type';
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
            
            for (const product of activeProducts) {
                // Main name
                this.indexProduct(product.name.toLowerCase(), product);
                
                // Synonyms
                if (product.synonyms && Array.isArray(product.synonyms)) {
                    for (const syn of product.synonyms) {
                        this.indexProduct(syn.toLowerCase(), product, true);
                    }
                }
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
     * Extracts entities from raw text
     */
    extract(text: string): ExtractedEntity[] {
        const normalized = this.normalizeText(text);
        const entities: ExtractedEntity[] = [];

        // 1. Quantities
        entities.push(...this.extractQuantities(normalized));

        // 2. Products (Greedy matching)
        entities.push(...this.extractProducts(normalized));

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
        const words = text.split(' ');

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
                entities.push({
                    type: 'quantity',
                    value: word,
                    normalizedValue: String(value),
                    confidence: 0.9,
                    position: [match.index, match.index + match[0].length]
                });
            }
        }

        // Digits
        const digitRegex = /\b(\d+(?:[.,]\d+)?)\b/g;
        let match;
        while ((match = digitRegex.exec(text)) !== null) {
            entities.push({
                type: 'quantity',
                value: match[1],
                normalizedValue: match[1].replace(',', '.'),
                confidence: 1.0,
                position: [match.index, match.index + match[0].length]
            });
        }

        return entities;
    }

    private extractProducts(text: string): ExtractedEntity[] {
        const entities: ExtractedEntity[] = [];
        const tokens = text.split(' ');

        // Try N-grams from 4 down to 1
        for (let n = Math.min(4, tokens.length); n >= 1; n--) {
            for (let i = 0; i <= tokens.length - n; i++) {
                const phrase = tokens.slice(i, i + n).join(' ');
                
                if (this.productCatalog.has(phrase)) {
                    const product = this.productCatalog.get(phrase);
                    entities.push({
                        type: 'product',
                        value: phrase,
                        normalizedValue: product.productName,
                        confidence: product.confidence,
                        position: [text.indexOf(phrase), text.indexOf(phrase) + phrase.length],
                        metadata: product
                    });
                } else if (n === 1 && phrase.length > 4) {
                    // Fuzzy match for single words (typos)
                    const fuzzy = this.fuzzySearch(phrase);
                    if (fuzzy) {
                        entities.push({
                            type: 'product',
                            value: phrase,
                            normalizedValue: fuzzy.productName,
                            confidence: 0.8,
                            position: [text.indexOf(phrase), text.indexOf(phrase) + phrase.length],
                            metadata: fuzzy
                        });
                    }
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
        // Remove overlapping entities, keeping the one with higher confidence or length
        entities.sort((a, b) => (b.position[1] - b.position[0]) - (a.position[1] - a.position[0]));
        
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
