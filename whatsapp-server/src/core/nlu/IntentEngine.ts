import { logger } from '../../utils/logger';

export interface ParsedEntities {
    items: Array<{
        product: string;
        qty: number;
        modifiers: string[];
    }>;
    intent: string;
}

export const INTENT_PATTERNS = {
    ORDER: [
        /(?:quiero|mandame|pedi|pido|traeme|una|unas|dos|tres|cuatro|cinco)\s+(.+)/i,
        /(?:sumame|agregame|mete|poné|pone|anota|anotame)\s+(.+)/i,
        /(?:para (?:comer|llevar)|delivery|para aca|retiro)/i,
        /^(?:\d+|una|unas|dos|tres|cuatro|cinco)\s+(?:empanada|hamburguesa|milanesa|pizza|coca|sprite|pollo|parrilla|chori|mila|napo|muzza)/i
    ],
    
    CANCEL: [
        /(?:cancela|anula|borra|saca|quito|quita)(?:\s+(?:todo|el pedido|eso))?/i,
        /^(?:cancelar|salir|chau)$/i,
        /(?:hace|haceme) (?:otra|de nuevo)/i // Lunfardo: "haceme otra" = reiniciar
    ],
    
    QUERY: [
        /(?:cuanto|precio|vale|cuesta|esta|está)\s+(.+)/i,
        /(?:tenes|hay|queda|quedan)\s+(.+)/i,
        /(?:que|cuales)\s+(?:hay|tenes|incluye)/i
    ],
    
    HELP: [
        /^(?:menu|menú|ayuda|help|opciones|que puedo|que tenes)/i,
        /(?:no entiendo|como funciona|que hago)/i
    ]
};

export class IntentEngine {
    
    static classify(text: string): { intent: string, confidence: number, entities: any } {
        const normalized = text.toLowerCase().trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
        
        // Layer 1: Regex O(1)
        for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
            for (const pattern of patterns) {
                const match = normalized.match(pattern);
                if (match) {
                    logger.info(`[IntentEngine] Regex match: ${intent} with pattern ${pattern}`);
                    const extracted = this.extractQuickEntities(match[1] || normalized);
                    return {
                        intent,
                        confidence: 0.95,
                        entities: extracted
                    };
                }
            }
        }
        
        return { intent: 'UNKNOWN', confidence: 0, entities: {} };
    }

    private static extractQuickEntities(text: string): ParsedEntities {
        // Lunfardo Argentino Mapping
        const lunfardoMap: Record<string, string> = {
            'coca': 'coca cola',
            'birra': 'cerveza',
            'hamburg': 'hamburguesa',
            'cheta': 'cheese burger',
            'completa': 'con todo',
            'sola': 'sin nada',
            'napo': 'napolitana',
            'muzza': 'muzzarella',
            'fuga': 'fugazzetta',
            'mila': 'milanesa',
            'parri': 'parrilla',
            'chori': 'chorizo',
            'sambuche': 'sandwich',
            'sanguchito': 'sandwich',
            'doc': 'docena'
        };

        let cleanText = text.toLowerCase();
        
        // Slang translation
        Object.entries(lunfardoMap).forEach(([slang, real]) => {
            cleanText = cleanText.replace(new RegExp(`\\b${slang}\\b`, 'g'), real);
        });

        // Pattern: "[cantidad] [producto] con [modificador]"
        // Supports: "una hamburguesa", "1 docena empanadas", "2 pollos a la parri"
        const pattern = /(?:quiero|mandame|pido|un|una|unas|el|la)?\s*(\d+|un|una|unas|dos|tres|cuatro|cinco|docena|media docena)?\s*(.+?)(?:\s+con\s+(.+))?$/i;
        
        const matches = cleanText.match(pattern);
        
        if (matches) {
            let qtyStr = (matches[1] || '1').trim().toLowerCase();
            let qty = 1;

            if (qtyStr === 'una' || qtyStr === 'un') qty = 1;
            else if (qtyStr === 'unas' || qtyStr === 'dos') qty = 2;
            else if (qtyStr === 'tres') qty = 3;
            else if (qtyStr === 'cuatro') qty = 4;
            else if (qtyStr === 'cinco') qty = 5;
            else if (qtyStr === 'docena') qty = 12;
            else if (qtyStr === 'media docena') qty = 6;
            else qty = parseInt(qtyStr) || 1;
            
            const product = matches[2].trim();
            const modifier = matches[3] ? matches[3].trim() : null;
            
            return {
                intent: 'ORDER',
                items: [{
                    product,
                    qty,
                    modifiers: modifier ? [modifier] : []
                }]
            };
        }
        
        return { intent: 'ORDER', items: [] };
    }
}
