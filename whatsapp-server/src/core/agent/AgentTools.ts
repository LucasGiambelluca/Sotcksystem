// ─── AgentTools (Producción) ──────────────────────────────────────────────────
// Basado en /agente IA/tools.ts — conectado a Supabase + ProductService reales.
// Mantiene la misma API (findProductWithScore, loadToolsContext, formatToolsForPrompt)
// para que AgentNode.ts no necesite cambiar.

import { supabase } from '../../config/database';
import { productService } from '../../services/ProductService';
import type { Product, Order, BusinessHours, ToolsContext, ProductMatch, OrderItem } from './AgentTypes';

// ─── Jaccard Similarity (Pilar 4) ────────────────────────────────────────────
// Tomado sin cambios de /agente IA/tools.ts porque el algoritmo es correcto.

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')   // quita acentos
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(Boolean);
}

function jaccardScore(a: string[], b: string[]): number {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = [...setA].filter(t => setB.has(t)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}

export function findProductWithScore(
    query: string,
    products: Product[],
    threshold = 0.15
): ProductMatch | null {
    const queryTokens = tokenize(query);
    let best: ProductMatch | null = null;

    for (const product of products) {
        const productTokens = tokenize(product.name);
        const score = jaccardScore(queryTokens, productTokens);
        if (score >= threshold && (!best || score > best.score)) {
            best = { product, score };
        }
    }

    return best;
}

// ─── Tool: Stock (conectado a ProductService real) ────────────────────────────

export async function fetchStock(): Promise<Product[]> {
    try {
        const products = await productService.getProducts();
        return products
            .filter(p => (p as any).is_active !== false)
            .map(p => ({
                id: String(p.id),
                name: p.name,
                price: productService.getEffectivePrice(p),
                stock: (p as any).stock ?? 999,
                category: (p as any).category || '',
            }));
    } catch {
        return [];
    }
}

// ─── Tool: Último pedido del cliente (conectado a Supabase real) ──────────────

export async function fetchLastOrder(clientPhone: string): Promise<Order | null> {
    try {
        const cleanPhone = clientPhone.replace(/[^0-9]/g, '');
        const { data } = await supabase
            .from('orders')
            .select('id, status, total, created_at, items')
            .eq('phone', cleanPhone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!data) return null;

        return {
            id: data.id,
            clientPhone: cleanPhone,
            items: Array.isArray(data.items) ? data.items : [],
            status: data.status,
            createdAt: new Date(data.created_at).getTime(),
            total: data.total,
        };
    } catch {
        return null;
    }
}

// ─── Tool: Horarios (conectado a Supabase real) ───────────────────────────────

export async function fetchBusinessHours(): Promise<BusinessHours> {
    try {
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'business_hours')
            .maybeSingle();

        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        let openHour = 9, closeHour = 22;

        if (data?.value) {
            const bh = data.value;
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const today = days[now.getDay()];
            const todayHours = bh[today];
            if (todayHours) {
                openHour = parseInt(todayHours.open?.split(':')[0] ?? '9');
                closeHour = parseInt(todayHours.close?.split(':')[0] ?? '22');
            }
        }

        const isOpen = hour >= openHour && hour < closeHour;
        const currentTime = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;

        return {
            open: `${String(openHour).padStart(2,'0')}:00`,
            close: `${String(closeHour).padStart(2,'0')}:00`,
            isOpen,
            message: isOpen
                ? `Estamos abiertos. Podés hacer tu pedido (${currentTime}hs).`
                : `Estamos cerrados. Abrimos a las ${String(openHour).padStart(2,'0')}:00hs.`,
        };
    } catch {
        const hour = new Date().getHours();
        const isOpen = hour >= 9 && hour < 22;
        return {
            open: '09:00', close: '22:00', isOpen,
            message: isOpen ? 'Estamos abiertos.' : 'Estamos cerrados por el momento.',
        };
    }
}

// ─── Carga todos los tools en paralelo ───────────────────────────────────────

export async function loadToolsContext(clientPhone?: string): Promise<ToolsContext> {
    const [products, lastOrder, businessHours] = await Promise.all([
        fetchStock(),
        clientPhone ? fetchLastOrder(clientPhone) : Promise.resolve(null),
        fetchBusinessHours(),
    ]);
    return { products, lastOrder, businessHours };
}

// ─── Formatea el contexto de tools para el prompt ────────────────────────────

export function formatToolsForPrompt(ctx: ToolsContext): string {
    const lines: string[] = [];

    if (ctx.businessHours) {
        lines.push(`[HORARIO] ${ctx.businessHours.message}`);
    }

    if (ctx.products && ctx.products.length > 0) {
        const productList = ctx.products
            .map(p => `  - ${p.name}: $${p.price}`)
            .join('\n');
        lines.push(`[CATÁLOGO DISPONIBLE]\n${productList}`);
    }

    if (ctx.lastOrder) {
        const itemList = ctx.lastOrder.items
            .map((i: OrderItem) => `${i.qty}x ${i.name}`)
            .join(', ');
        lines.push(`[ÚLTIMO PEDIDO DEL CLIENTE] ${itemList} — Estado: ${ctx.lastOrder.status}`);
    }

    return lines.join('\n\n');
}

// ─── Resuelve items de la IA contra el catálogo real ─────────────────────────

export function resolveItems(
    items: { name: string; qty: number }[] | undefined,
    products: Product[]
): { name: string; qty: number; resolvedName?: string; resolvedId?: string; price?: number; matchScore?: number }[] {
    if (!items || items.length === 0) return [];
    return items.map(item => {
        const match = findProductWithScore(item.name, products);
        if (match && match.score > 0.15) {
            return {
                ...item,
                resolvedName: match.product.name,
                resolvedId: match.product.id,
                price: match.product.price,
                matchScore: match.score,
            };
        }
        return item;
    });
}
