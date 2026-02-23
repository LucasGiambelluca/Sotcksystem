import { supabase } from '../config/database';
import deliverySlotService from './DeliverySlotService';

export interface OrderItem {
    product_id: string;
    qty: number;
    price: number;
    name?: string;
}

export class OrderService {
    private db: any;
    private slotService: any;

    constructor(dbClient?: any, slotServiceInstance?: any) {
        this.db = dbClient || supabase;
        this.slotService = slotServiceInstance || deliverySlotService;
    }
    /**
     * Crea un pedido completo siguiendo la lógica de KitchenFlow.
     */
    async createOrder(params: {
        phone: string;
        items: OrderItem[];
        total: number;
        deliverySlotId?: string;
        address?: string;
        deliveryDate?: string | Date;
        paymentMethod?: string;
        pushName?: string;
        chatContext?: any;
    }) {
        const { phone, items, total, deliverySlotId, address, deliveryDate, paymentMethod, pushName, chatContext } = params;

        // 1. Buscar o crear cliente
        let { data: client } = await this.db
            .from('clients')
            .select('id')
            .eq('phone', phone)
            .maybeSingle();

        if (!client) {
            const { data: newClient, error: clientError } = await this.db
                .from('clients')
                .insert({ phone, name: pushName || phone })
                .select()
                .single();
            
            if (clientError) throw new Error(`Error creando cliente: ${clientError.message}`);
            client = newClient;
        }

        // 2. Reservar Slot de entrega (si aplica)
        if (deliverySlotId) {
            const reserved = await this.slotService.reserveSlot(deliverySlotId);
            if (!reserved) {
                throw new Error('Lo sentimos, el horario elegido ya no tiene cupo disponible.');
            }
        }

        // 3. Crear la Orden (Cabecera)
        const { data: order, error: orderError } = await this.db
            .from('orders')
            .insert({
                client_id: client.id,
                phone: phone,
                channel: 'WHATSAPP',
                status: 'PENDING',
                total_amount: total,
                subtotal: total, // Por ahora igual al total si no hay descuentos/envío
                delivery_slot_id: deliverySlotId,
                delivery_address: address,
                delivery_date: deliveryDate ? new Date(deliveryDate).toISOString() : null,
                payment_method: paymentMethod,
                chat_context: chatContext || {}
            })
            .select()
            .single();

        if (orderError) {
            // Rollback del slot si falla la orden
            if (deliverySlotId) await this.slotService.releaseSlot(deliverySlotId);
            throw new Error(`Error creando orden: ${orderError.message}`);
        }

        // 4. Crear los Items y actualizar Stock
        const orderItemsData = items.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.qty,
            unit_price: item.price
        }));

        const { error: itemsError } = await this.db
            .from('order_items')
            .insert(orderItemsData);

        if (itemsError) {
            console.error('[OrderService] Error guardando items:', itemsError);
        }

        // 5. Descontar Stock (Atómico simplificado)
        for (const item of items) {
            const { error: stockError } = await this.db.rpc('decrement_product_stock', {
                p_id: item.product_id,
                p_qty: item.qty
            });
            
            if (stockError) {
                // Fallback manual
                const { data: prod } = await this.db.from('products').select('stock').eq('id', item.product_id).single();
                if (prod) {
                    await this.db.from('products').update({ stock: Math.max(0, prod.stock - item.qty) }).eq('id', item.product_id);
                }
            }
        }

        return order;
    }

    /**
     * Actualiza el estado de un pedido con validación de transiciones.
     */
    /**
     * Asigna automáticamente el pedido a un preparador disponible con menos carga.
     */
    async autoAssignOrder(orderId: string): Promise<string | null> {
        // 1. Buscar preparadores activos y disponibles
        const { data: preparers, error } = await this.db
            .from('users')
            .select('id, name')
            .eq('role', 'PREPARER')
            .eq('is_active', true)
            .eq('current_status', 'ONLINE');

        if (error) {
            console.error('[OrderService] Error fetching preparers:', error);
        }

        if (!preparers || preparers.length === 0) {
            console.warn('[OrderService] No hay preparadores disponibles para asignación automática.');
            return null;
        }

        // 2. Obtener carga actual de cada preparador
        const preparerLoads = await Promise.all(preparers.map(async (p) => {
            const { count } = await this.db
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', p.id)
                .in('status', ['ASSIGNED', 'PREPARING']);
            return { id: p.id, load: count || 0 };
        }));

        // 3. Ordenar por carga y tomar el menor
        preparerLoads.sort((a, b) => a.load - b.load);
        const bestPreparer = preparerLoads[0];

        // 4. Asignar
        const { error: assignError } = await this.db
            .from('orders')
            .update({ 
                assigned_to: bestPreparer.id,
                status: 'CONFIRMED',
                assigned_at: new Date()
            })
            .eq('id', orderId);

        if (assignError) {
            console.error('[OrderService] Error en auto-asignación:', assignError);
            return null;
        }

        return bestPreparer.id;
    }

    /**
     * Parsea texto natural para identificar productos y cantidades.
     * Soporta entradas informales: "2 coca", "una hambu", "3 papas grandes"
     */
    async parseOrderText(text: string): Promise<OrderItem[]> {
        // Use productService (proven to work) instead of this.db
        const { productService } = require('./ProductService');
        const products = await productService.getProducts();
        
        console.log(`[OrderParser] 🔍 DB returned ${products?.length || 0} products for matching`);
        if (!products || products.length === 0) {
            console.log('[OrderParser] ⚠️ No products available!');
            return [];
        }

        const items: OrderItem[] = [];
        // Split by comma, "y", newline, or "+" 
        const parts = text.toLowerCase().split(/[,\n+]|\by\b/);

        for (const part of parts) {
            const cleanPart = part.trim();
            if (!cleanPart) continue;

            // Try to extract quantity: "2 coca", "una pizza", "dos hamburguesas"
            let qty = 1;
            let searchName = cleanPart;

            // Numeric prefix: "2 coca", "10 empanadas"
            const numMatch = cleanPart.match(/^(\d+)\s+(.+)$/);
            if (numMatch) {
                qty = parseInt(numMatch[1]);
                searchName = numMatch[2];
            } else {
                // Spanish word numbers: "una coca", "dos pizzas", etc.
                const wordNumbers: Record<string, number> = {
                    'un': 1, 'una': 1, 'uno': 1,
                    'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
                    'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
                    'media': 1, 'medio': 1
                };
                const wordMatch = cleanPart.match(/^(\w+)\s+(.+)$/);
                if (wordMatch && wordNumbers[wordMatch[1]]) {
                    qty = wordNumbers[wordMatch[1]];
                    searchName = wordMatch[2];
                }
            }

            // Find best matching product
            const bestMatch = this.findBestProduct(searchName, products);
            
            if (bestMatch) {
                // Check if we already added this product (merge quantities)
                const existing = items.find(i => i.product_id === bestMatch.product.id);
                if (existing) {
                    existing.qty += qty;
                } else {
                    items.push({
                        product_id: bestMatch.product.id,
                        qty: qty,
                        price: bestMatch.product.price,
                        name: bestMatch.product.name
                    });
                }
                console.log(`[OrderParser] "${searchName}" → "${bestMatch.product.name}" (score: ${bestMatch.score.toFixed(2)}, qty: ${qty})`);
            } else {
                console.log(`[OrderParser] ❌ No match for "${searchName}"`);
            }
        }
        return items;
    }

    /**
     * Busca el mejor producto usando múltiples estrategias de matching.
     */
    private findBestProduct(search: string, products: any[]): { product: any; score: number } | null {
        const normalizedSearch = this.normalize(search);
        const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 1);
        
        let bestProduct = null;
        let maxScore = 0;

        for (const p of products) {
            const normalizedName = this.normalize(p.name);
            const nameWords = normalizedName.split(/\s+/).filter(w => w.length > 1);
            
            let score = 0;

            // Strategy 1: Exact match (1.0)
            if (normalizedName === normalizedSearch) {
                score = 1.0;
            }
            // Strategy 2: Full search is contained in product name (0.85)
            //   e.g. "coca" is in "coca cola 500ml"
            else if (normalizedName.includes(normalizedSearch)) {
                score = 0.85;
            }
            // Strategy 3: Product name is contained in search (0.75)
            //   e.g. search "coca cola grande" contains product "coca cola"
            else if (normalizedSearch.includes(normalizedName)) {
                score = 0.75;
            }
            // Strategy 4: Word-level matching
            else {
                // Check how many search words match product name words
                let matchedWords = 0;
                for (const sw of searchWords) {
                    for (const nw of nameWords) {
                        // Word starts with search term: "hambu" matches "hamburguesa"
                        if (nw.startsWith(sw) || sw.startsWith(nw)) {
                            matchedWords++;
                            break;
                        }
                        // Levenshtein for typos (only for words >= 4 chars)
                        if (sw.length >= 4 && nw.length >= 4) {
                            const dist = this.levenshtein(sw, nw);
                            const maxLen = Math.max(sw.length, nw.length);
                            if (dist / maxLen <= 0.3) { // Allow ~30% error
                                matchedWords++;
                                break;
                            }
                        }
                    }
                }
                if (searchWords.length > 0) {
                    score = (matchedWords / searchWords.length) * 0.7;
                }
            }

            if (score > maxScore) {
                maxScore = score;
                bestProduct = p;
            }
        }

        // Minimum threshold to accept a match
        if (bestProduct && maxScore >= 0.3) {
            return { product: bestProduct, score: maxScore };
        }
        return null;
    }

    /**
     * Normaliza texto: quita acentos, pasa a minúsculas, quita caracteres especiales.
     */
    private normalize(text: string): string {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics/accents
            .replace(/[^a-z0-9\s]/g, '')     // Remove special chars
            .trim();
    }

    /**
     * Calcula la distancia de Levenshtein entre dos strings.
     */
    private levenshtein(a: string, b: string): number {
        const matrix: number[][] = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b[i - 1] === a[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,       // insertion
                        matrix[i - 1][j] + 1         // deletion
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }
}

export default new OrderService();
