import type {
  Product,
  Order,
  BusinessHours,
  ToolsContext,
  ProductMatch,
} from "./types";

// ─── Simulated DB (reemplazá con tus queries reales) ─────────────────────────

const MOCK_PRODUCTS: Product[] = [
  { id: "p1", name: "Empanada de carne", price: 350, stock: 40 },
  { id: "p2", name: "Empanada de jamón y queso", price: 350, stock: 30 },
  { id: "p3", name: "Sándwich de Mila Completa", price: 1800, stock: 12 },
  { id: "p4", name: "Sándwich de pollo", price: 1600, stock: 8 },
  { id: "p5", name: "Coca Cola 500ml", price: 600, stock: 50 },
  { id: "p6", name: "Agua mineral", price: 400, stock: 60 },
];

// ─── Similarity search (Pilar 4) ─────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function jaccardScore(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
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

// ─── Tool: Stock ──────────────────────────────────────────────────────────────

export async function fetchStock(): Promise<Product[]> {
  // Reemplazá con: return await db.products.findAll({ where: { stock: { $gt: 0 } } })
  return MOCK_PRODUCTS.filter((p) => p.stock > 0);
}

// ─── Tool: Último pedido del cliente ─────────────────────────────────────────

export async function fetchLastOrder(
  clientPhone: string
): Promise<Order | null> {
  // Reemplazá con: return await db.orders.findOne({ where: { clientPhone }, order: [['createdAt', 'DESC']] })
  const mockOrders: Order[] = [
    {
      id: "ord_001",
      clientPhone: "5491112345678",
      items: [{ name: "Empanada de carne", qty: 4 }],
      status: "delivered",
      createdAt: Date.now() - 86400000,
      total: 1400,
    },
  ];
  return mockOrders.find((o) => o.clientPhone === clientPhone) ?? null;
}

// ─── Tool: Horarios ───────────────────────────────────────────────────────────

export async function fetchBusinessHours(): Promise<BusinessHours> {
  // Reemplazá con consulta real a tu config de horarios
  const now = new Date();
  const hour = now.getHours();
  const isOpen = hour >= 9 && hour < 22;

  return {
    open: "09:00",
    close: "22:00",
    isOpen,
    message: isOpen
      ? "Estamos abiertos. Podés hacer tu pedido."
      : "Estamos cerrados. Abrimos mañana a las 9:00.",
  };
}

// ─── Carga todos los tools y los formatea para el prompt ─────────────────────

export async function loadToolsContext(
  clientPhone?: string
): Promise<ToolsContext> {
  const [products, lastOrder, businessHours] = await Promise.all([
    fetchStock(),
    clientPhone ? fetchLastOrder(clientPhone) : Promise.resolve(null),
    fetchBusinessHours(),
  ]);

  return { products, lastOrder, businessHours };
}

export function formatToolsForPrompt(ctx: ToolsContext): string {
  const lines: string[] = [];

  if (ctx.businessHours) {
    lines.push(`[HORARIO] ${ctx.businessHours.message}`);
  }

  if (ctx.products && ctx.products.length > 0) {
    const productList = ctx.products
      .map((p) => `  - ${p.name}: $${p.price} (stock: ${p.stock})`)
      .join("\n");
    lines.push(`[STOCK DISPONIBLE]\n${productList}`);
  }

  if (ctx.lastOrder) {
    const itemList = ctx.lastOrder.items
      .map((i) => `${i.qty}x ${i.name}`)
      .join(", ");
    lines.push(
      `[ÚLTIMO PEDIDO DEL CLIENTE] ${itemList} — Estado: ${ctx.lastOrder.status}`
    );
  }

  return lines.join("\n\n");
}
