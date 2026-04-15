// ─── Agent Input / Output ────────────────────────────────────────────────────

export type IntentType = "ORDER" | "INFO" | "GREETING" | "CANCEL" | "FALLBACK";

export interface AgentInput {
  text?: string;
  transcription?: string; // Pilar 1: captura dinámica del "bolsillo"
  clientPhone?: string;
  clientName?: string;
  sessionId: string;
}

export interface OrderItem {
  name: string;       // nombre tal como lo dijo el usuario
  qty: number;
  resolvedName?: string; // Pilar 4: nombre real en la DB
  resolvedId?: string;
  price?: number;
}

export interface AgentResponse {
  intent: IntentType;
  response: string;
  items?: OrderItem[];
  confidence?: number;
  rawJson?: string;
}

// ─── Memory ──────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  intent?: IntentType;
}

export interface AgentMemory {
  sessionId: string;
  history: MemoryEntry[];
  clientPhone?: string;
  lastOrderId?: string;
}

// ─── Tools / Superpoderes ────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category?: string;
}

export interface Order {
  id: string;
  clientPhone: string;
  items: OrderItem[];
  status: "pending" | "confirmed" | "delivered" | "cancelled";
  createdAt: number;
  total: number;
}

export interface BusinessHours {
  open: string;   // "09:00"
  close: string;  // "22:00"
  isOpen: boolean;
  message: string;
}

export interface ToolsContext {
  products?: Product[];
  lastOrder?: Order | null;
  businessHours?: BusinessHours;
}

// ─── Node State (para el diagrama visual) ────────────────────────────────────

export type NodeStatus = "idle" | "processing" | "success" | "error";

export type PillarId = "capture" | "tools" | "json" | "resolver";

export interface PillarState {
  id: PillarId;
  label: string;
  sublabel: string;
  status: NodeStatus;
}

export interface AgentNodeState {
  status: NodeStatus;
  activeIntent: IntentType | null;
  pillars: PillarState[];
  lastResponse: AgentResponse | null;
  memorySize: number;
  toolsLoaded: boolean;
}

// ─── Product similarity search ───────────────────────────────────────────────

export interface ProductMatch {
  product: Product;
  score: number;
}
