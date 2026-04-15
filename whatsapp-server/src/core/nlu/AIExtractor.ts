import { AIService } from '../../services/AIService';
import { productService } from '../../services/ProductService';
import { logger } from '../../utils/logger';

/**
 * Result of AI-powered message understanding.
 */
export interface AIExtractionResult {
    intent: 'order' | 'inquiry' | 'promotion_inquiry' | 'greeting' | 'confirmation' | 'rejection' | 'support' | 'menu_request' | 'checkout' | 'unknown';
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
    /** Raw AI result for proactive logic */
    aiResult?: any;
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

const SYSTEM_PROMPT = `Eres el Asistente de "El Pollo Comilón", una rotisería de Bahía Blanca.
Tu objetivo es ayudar a los clientes a realizar sus pedidos de forma amable, profesional y eficiente.

TONO Y PERSONALIDAD:
- Sé siempre respetuoso y servicial. Usa "Hola" para saludar.
- Evita modismos excesivamente informales (no uses "Che", "viste", ni "qué onda").
- Mantén un lenguaje natural pero profesional y cálido.
- Si conoces el nombre del cliente, úsalo (ej: "Hola Lucas, ¿cómo estás?").
- No presiones al cliente. Deja que la conversación fluya y bríndale la información que necesite.

CONTEXTO Y MEMORIA:
- Eres consciente del Historial de la charla y del CARRITO ACTUAL DEL CLIENTE.
- TU MISIÓN: Devolver la LISTA FINAL COMPLETA de ítems del pedido.
- REGLA DE ORO DE PERSISTENCIA: Todo producto que figure en el "CARRITO ACTUAL" DEBE ser incluido en tu respuesta JSON final, a menos que el usuario pida explícitamente quitarlo o cambiarlo. Omitir un producto que ya estaba es un error crítico.
- REGLA DE CAMBIO: Si el cliente dice "cambiame X por Y" y no especifica cantidad, usa la cantidad que tenía X en el carrito previo para el nuevo producto Y.
- REGLA DE SUMA: Si el cliente dice "agregame uno más de X", busca cuánto tenía X en el carrito y devuélvenos el total (ej: 4+1=5).
- Si el cliente confirma el pedido ("está bien", "dale", "si"), mantén la lista de ítems exactamente como estaba en el carrito previo.

EXTRACCIÓN DE DATOS (JSON):
Debes analizar el mensaje del usuario y extraer la información en este formato JSON exacto:
{
  "intent": "ORDER" | "CHECKOUT" | "GREETING" | "INQUIRY" | "CANCEL" | "UNKNOWN",
  "items": [{ "name": string, "qty": number }],
  "address": string | null,
  "payment_method": "efectivo" | "transferencia" | null,
  "delivery_method": "delivery" | "retiro" | null,
  "customer_name": string | null,
  "reasoning": "Resumen de cambios: Detallá qué productos mantuviste del carrito anterior y por qué modificaste el resto."
}

REGLAS DE EXTRACCIÓN:
1. "ORDER": Si el cliente pide productos (ej: "quiero 2 pizzas"). IMPORTANTE: Si pide productos Y da una dirección en el mismo mensaje (ej: "2 pizzas a Newton 1639"), usa intent "ORDER" y NO olvides extraer la dirección en el campo "address".
2. "CHECKOUT": Si el cliente quiere finalizar, da su dirección o pregunta cuánto debe pagar, PERO NO está pidiendo productos nuevos en este mensaje.
3. "GREETING": Si es solo un saludo inicial.
4. "INQUIRY": Si pregunta por precios, sabores o recomendaciones.
5. EXTRACCIÓN DE DIRECCIÓN: Sé muy preciso extrayendo la dirección. Si dice "mandalo a...", "estoy en...", "es para...", captura el texto de la dirección.
6. NO asumas la dirección de entrega de forma invasiva si el cliente solo está consultando.

IMPORTANTE: Responde ÚNICAMENTE con el bloque JSON. No incluyas explicaciones fuera del JSON.`;

export class AIExtractor {

    /**
     * Main entry point: analyze a WhatsApp message using AI.
     * Falls back gracefully if AI is unavailable.
     */
    static async analyze(text: string, options: { history?: any[], cart?: any[] } = {}): Promise<AIExtractionResult | null> {
        if (!AIService.isAvailable()) {
            logger.debug('[AIExtractor] AI Service not configured, skipping AI analysis');
            return null;
        }

        const startTime = Date.now();
        const clean = text.trim();
        if (clean.length < 2) return null;

        try {
            logger.info(`🔍 [AUDIT] Analyzing message: "${text}" | Context: History(${options.history?.length || 0}), Cart(${options.cart?.length || 0})`);

            const cartStr = options.cart?.length 
                ? options.cart.map((i: any) => `${i.qty}x ${i.name}`).join(', ') 
                : 'Vacío';
            
            logger.info(`🤖 [AI Context] Cart: ${cartStr} | History items: ${options.history?.length || 0}`);
            
            const detailedPrompt = `${SYSTEM_PROMPT}\n\nCARRITO ACTUAL DEL CLIENTE (Usa esto para entender menciones a cambios o remociones):\n${cartStr}`;

            const raw = await AIService.extractJSON<any>({
                systemPrompt: detailedPrompt,
                userMessage: text,
                history: options.history,
                temperature: 0.05,
                maxTokens: 500,
            });

            if (!raw) {
                logger.warn(`⚠️ [AUDIT] AI failed to return valid JSON for: "${text}"`);
                return null;
            }

            // Build result
            const result: AIExtractionResult = {
                intent: (raw.intent || 'unknown').toLowerCase() as any,
                items: [],
                address: raw.address || undefined,
                paymentMethod: raw.payment_method || undefined,
                deliveryMethod: raw.delivery_method || undefined,
                customerName: raw.customer_name || undefined,
                reasoning: raw.reasoning || undefined,
                confidence: 0.85,
                aiResult: raw
            };

            // AUDIT LOG: Reasoning and Intent
            console.log('\n--- 🧠 AI INTERPRETATION ---');
            console.log(`📡 Intent: ${result.intent.toUpperCase()}`);
            console.log(`🤔 Reasoning: ${result.reasoning || 'N/A'}`);
            console.log('---------------------------\n');

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

                    const matchResult = await productService.findProductWithScore(itemName);
                    if (matchResult) {
                        extractedItem.resolvedProduct = {
                            id: matchResult.product.id,
                            name: matchResult.product.name,
                            price: productService.getEffectivePrice(matchResult.product),
                        };
                        extractedItem.matchConfidence = matchResult.score;
                    } else {
                        const similar = await productService.searchSimilarProducts(itemName);
                        if (similar.length === 1) {
                            const prod = similar[0];
                            extractedItem.resolvedProduct = {
                                id: prod.id,
                                name: prod.name,
                                price: productService.getEffectivePrice(prod),
                            };
                            extractedItem.matchConfidence = 0.7;
                        }
                    }

                    result.items.push(extractedItem);
                }
            }

            const duration = Date.now() - startTime;
            logger.info(`✅ [AUDIT] Analysis complete (${duration}ms)`, {
                intent: result.intent,
                itemCount: result.items.length
            });

            return result;
        } catch (err: any) {
            logger.error(`❌ [AUDIT] Analysis failed`, { error: err.message });
            return null;
        }
    }

    /**
     * Generates a natural language response based on the extraction result and catalog.
     */
    static async generateNaturalResponse(query: string, result: AIExtractionResult, context: any = {}): Promise<string> {
        const products = await productService.getProducts();
        const catalogStr = products.map(p => `- ${p.name}: $${productService.getEffectivePrice(p)}`).join('\n');
        
        const customerName = context.pushName || context.customer_name || 'cliente';
        const lastAddress = context.direccion_cliente || context.lastAddress;

        const personality = `Eres un asistente respetuoso de la rotisería "El Pollo Comilón". Saluda cordialmente (usa "Hola") y trata al cliente con respeto. No uses modismos informales como "Che" o "Viste". Tu tono debe ser cálido pero profesional. No presiones al cliente para cerrar la venta, ayúdalo con lo que necesite.`;

        const prompt = `${personality}
CATÁLOGO DISPONIBLE:
${catalogStr}

CONTEXTO:
- Cliente: ${customerName}
- Dirección guardada: ${lastAddress || 'No disponible'}
- Intención detectada: ${result.intent}
- Productos en carrito/detectados: ${result.items.map(i => `${i.quantity}x ${i.rawName}`).join(', ')}

REGLAS DE RESPUESTA:
1. Si el cliente pregunta por la comida, responde con amabilidad basándote en el catálogo.
2. Si el cliente parece estar terminando, confirma amablemente si desea agregar algo más. No preguntes agresivamente por la dirección si ya la sabes, solo confírmala si corresponde terminar.
3. Sé breve y útil.

Mensaje del cliente: "${query}"`;

        try {
            const response = await AIService.complete({
                systemPrompt: prompt,
                userMessage: "Genera una respuesta amable para este cliente.",
                temperature: 0.7,
                maxTokens: 300
            });
            return response.trim();
        } catch (err) {
            logger.error('[AIExtractor] natural response failed', { error: (err as any).message });
            return `Hola ${customerName}, ¿en qué puedo ayudarte hoy?`;
        }
    }

    static async resolveMenuOption(input: string, options: string[]): Promise<number> {
        if (!AIService.isAvailable() || options.length === 0) return -1;
        try {
            const prompt = `Un cliente respondió a un menú de opciones.\nOpciones disponibles:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nRespuesta del cliente: "${input}"\n\nIdentifica el número de la opción elegida. Responde ÚNICAMENTE con el número entero. Si no hay una opción clara, responde -1.`;
            const response = await AIService.complete({
                systemPrompt: "Eres un clasificador numérico estricto.",
                userMessage: prompt,
                temperature: 0.1
            });
            const match = response.match(/-?\d+/);
            if (match) {
                const num = parseInt(match[0], 10);
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
