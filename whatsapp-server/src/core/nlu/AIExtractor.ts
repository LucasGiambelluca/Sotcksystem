import { AIService } from '../../services/AIService';
import { productService } from '../../services/ProductService';
import { logger } from '../../utils/logger';

/**
 * Result of AI-powered message understanding.
 */
export interface AIExtractionResult {
    intent: 'order' | 'inquiry' | 'greeting' | 'confirmation' | 'rejection' | 'support' | 'menu_request' | 'unknown';
    items: AIExtractedItem[];
    /** Free-text delivery address if mentioned */
    address?: string;
    /** Payment method if mentioned */
    paymentMethod?: string;
    /** Delivery preference if mentioned */
    deliveryMethod?: string;
    /** Customer name if mentioned */
    customerName?: string;
    /** Original reasoning from the AI */
    reasoning?: string;
    /** Overall confidence 0-1 */
    confidence: number;
}

export interface AIExtractedItem {
    rawName: string;
    quantity: number;
    /** Resolved product from database */
    resolvedProduct?: {
        id: string;
        name: string;
        price: number;
    };
    /** Match confidence 0-1 */
    matchConfidence: number;
}

const SYSTEM_PROMPT = `Sos un asistente de pedidos para un restaurante/rotisería argentino. Tu trabajo es analizar mensajes de clientes de WhatsApp y extraer información estructurada.

REGLAS:
1. Detectá la INTENCIÓN del mensaje:
   - "order": El cliente quiere pedir, agregar o comprar productos. OJO: Si el cliente menciona productos específicos con sus atributos (ej: "una de carne frita", "dos muzza") o simplemente el nombre de un producto del catálogo de forma directa, asumí "order" aunque no diga "quiero".
   - "inquiry": Preguntas generales sobre disponibilidad, precios o qué cosas tienen (ej: "¿qué tenés?", "¿cuánto sale...?", "¿tenés empanadas?").
   - "greeting": Saludo simple (ej: "hola").
   - "confirmation": "sí", "dale", "anotame eso".
   - "rejection": "no", "nada mas", "cancelar".
   - "support": ayuda humana.
   - "menu_request": "ver el menú", "qué hay para comer?".
   - "unknown": No se puede determinar

2. Extraé PRODUCTOS con cantidades. Usá lenguaje natural argentino:
   - "un" / "una" = 1
   - "dos" = 2, "media docena" = 6, "docena" = 12
   - Si no dice cantidad, asumí 1
   - Separá productos compuestos: "pollo con papas" puede ser un solo producto o dos

3. Extraé DIRECCIÓN si la mencionan (ej: "para enviar a San Martín 123")
4. Extraé MÉTODO DE PAGO si lo dicen (ej: "pago en efectivo", "transferencia")
5. Extraé MÉTODO DE ENTREGA si lo dicen (ej: "delivery", "retiro en el local")
6. RESOLUCIÓN DE MODISMOS: Traducí abreviaciones comunes a su nombre completo en el JSON:
   - "napo" -> "napolitana"
   - "muzza" -> "muzzarella"
   - "fugaz" -> "fugazzetta"
   - "mila" -> "milanesa"
   - "roque" -> "roquefort"
   - "jyq" / "j y q" -> "jamon y queso"
   - "papas" -> "papas fritas" (si no especifica otro tipo)

Respondé SIEMPRE en JSON con esta estructura exacta:
{
  "intent": "order|inquiry|greeting|confirmation|rejection|support|menu_request|unknown",
  "items": [{"name": "nombre del producto", "qty": 1}],
  "address": "dirección si la mencionaron o null",
  "payment_method": "efectivo|transferencia|null",
  "delivery_method": "delivery|retiro|null",
  "customer_name": "nombre del cliente si lo dice o null",
  "reasoning": "breve explicación de tu análisis"
}`;

export class AIExtractor {

    /**
     * Main entry point: analyze a WhatsApp message using AI.
     * Falls back gracefully if AI is unavailable.
     */
    static async analyze(text: string): Promise<AIExtractionResult | null> {
        if (!AIService.isAvailable()) {
            logger.debug('[AIExtractor] Groq not configured, skipping AI analysis');
            return null;
        }

        // Skip very short or obviously simple messages
        const clean = text.trim().toLowerCase();
        if (clean.length < 2) return null;

        try {
            const raw = await AIService.extractJSON<any>({
                systemPrompt: SYSTEM_PROMPT,
                userMessage: text,
                temperature: 0.05, // Very deterministic for extraction
                maxTokens: 400,
            });

            if (!raw) return null;

            // Build result
            const result: AIExtractionResult = {
                intent: raw.intent || 'unknown',
                items: [],
                address: raw.address || undefined,
                paymentMethod: raw.payment_method || undefined,
                deliveryMethod: raw.delivery_method || undefined,
                customerName: raw.customer_name || undefined,
                reasoning: raw.reasoning || undefined,
                confidence: 0.85, // Base confidence for AI extraction
            };

            // Resolve each extracted item against the product database
            if (raw.items && Array.isArray(raw.items)) {
                for (const rawItem of raw.items) {
                    const itemName = rawItem.name || rawItem.product || '';
                    const qty = rawItem.qty || rawItem.quantity || 1;

                    if (!itemName) continue;

                    const extractedItem: AIExtractedItem = {
                        rawName: itemName,
                        quantity: qty,
                        matchConfidence: 0,
                    };

                    // Try to match against the real product database
                    const matchResult = await productService.findProductWithScore(itemName);
                    if (matchResult) {
                        extractedItem.resolvedProduct = {
                            id: matchResult.product.id,
                            name: matchResult.product.name,
                            price: productService.getEffectivePrice(matchResult.product),
                        };
                        extractedItem.matchConfidence = matchResult.score;
                    } else {
                        // Try fuzzy search as fallback
                        const similar = await productService.searchSimilarProducts(itemName);
                        if (similar.length === 1) {
                            const prod = similar[0];
                            extractedItem.resolvedProduct = {
                                id: prod.id,
                                name: prod.name,
                                price: productService.getEffectivePrice(prod),
                            };
                            extractedItem.matchConfidence = 0.7;
                        } else if (similar.length > 1) {
                            // Ambiguous — attach all options for the router to handle
                            extractedItem.matchConfidence = 0.4;
                            (extractedItem as any).ambiguousOptions = similar.map(p => ({
                                id: p.id,
                                name: p.name,
                                price: productService.getEffectivePrice(p),
                            }));
                        }
                    }

                    result.items.push(extractedItem);
                }
            }

            // Adjust overall confidence based on item resolution
            if (result.items.length > 0) {
                const avgMatch = result.items.reduce((s, i) => s + i.matchConfidence, 0) / result.items.length;
                result.confidence = Math.min(0.95, 0.7 + avgMatch * 0.25);
            }

            logger.info(`[AIExtractor] Analysis complete`, {
                intent: result.intent,
                itemCount: result.items.length,
                confidence: result.confidence.toFixed(2),
                reasoning: result.reasoning?.substring(0, 80),
            });

            return result;
        } catch (err: any) {
            logger.error(`[AIExtractor] Analysis failed`, { error: err.message });
            return null; // Graceful degradation
        }
    }

    /**
     * Generates a natural language response based on the extraction result and catalog.
     */
    static async generateNaturalResponse(query: string, result: AIExtractionResult): Promise<string> {
        const products = await productService.getProducts();
        const catalogStr = products.map(p => `- ${p.name}: $${productService.getEffectivePrice(p)}${p.category ? ` (${p.category})` : ''}`).join('\n');

        const prompt = `Sos el asistente inteligente de una rotisería argentina. Tu objetivo es responderle al cliente de forma amable, clara y simpática, con un trato cercano.
Usa el CATALOGO REAL de abajo para responder. Si lo que pide no está, decilo educadamente pero ofrecé una alternativa del menú.

CATALOGO:
${catalogStr}

CONTEXTO DEL MENSAJE:
- Intención: ${result.intent}
- Productos detectados: ${result.items.map(i => i.rawName).join(', ')}
- Razonamiento previo: ${result.reasoning}

REGLAS DE ORO:
1. Hablá con un tono argentino natural (usá "vos"), pero NO fuerces modismos como "che", "querido", o "genio" en cada oración. Mantené la naturalidad.
2. Sé breve y directo. Confirmá el stock o precio de lo que piden sin dar mucha vuelta.
3. Al terminar, si es necesario, sumá una sola pregunta sencilla para avanzar (ej: "¿Te anoto una?", "¿Querés sumar algo más?").
4. Si la consulta es muy genérica, pedí que precisen.
5. NO inventes productos ni precios que no estén en el CATALOGO.
6. Si preguntan algo que no podés resolver, avisales amablemente que enseguida los atiende un humano.
7. RESOLVI abreviaciones locales: "napo" es napolitana, "muzza" es muzzarella, "doc" es docena.

Pregunta del cliente: "${query}"`;

        try {
            const response = await AIService.complete({
                systemPrompt: prompt,
                userMessage: "Generá la respuesta para el cliente.",
                temperature: 0.7,
                maxTokens: 300
            });
            return response.trim();
        } catch (err) {
            logger.error('[AIExtractor] natural response failed', { error: (err as any).message });
            return "¡Hola! ¿Cómo puedo ayudarte con tu pedido? Podés ver nuestro menú escribiendo *menú*.";
        }
    }
    /**
     * Uses the LLM to map a user's free-text input to one of the provided options.
     * Returns the 0-based index of the matched option, or -1 if no good match.
     */
    static async resolveMenuOption(input: string, options: string[]): Promise<number> {
        if (!AIService.isAvailable() || options.length === 0) return -1;
        
        try {
            const prompt = `Un cliente respondió a un menú de opciones.\nOpciones disponibles:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nRespuesta del cliente: "${input}"\n\nTu tarea: Identifica cuál opción eligió el cliente. Puede usar el número de la opción o palabras clave (ej: si dice "carne" y hay "empanadas de carne", elige esa). El cliente también puede poner solo el producto (ej: "1 docena de empanadas de carne a cuchillo"). Resuelve esto incluso con errores de ortografía. Responde ÚNICAMENTE con el número entero de la opción (ej: 1, 2, 3). Si la respuesta no tiene nada que ver con ninguna opción y no se puede deducir, responde -1.`;
            
            const response = await AIService.complete({
                systemPrompt: "Sos un clasificador estricto que solo responde con números enteros.",
                userMessage: prompt,
                temperature: 0.1
            });
            
            const match = response.match(/-?\d+/);
            if (match) {
                const num = parseInt(match[0], 10);
                if (num === -1) return -1;
                const idx = num - 1;
                return (idx >= 0 && idx < options.length) ? idx : -1;
            }
            return -1;
        } catch (e) {
            logger.error('[AIExtractor] Error in resolveMenuOption:', e);
            return -1;
        }
    }
}
