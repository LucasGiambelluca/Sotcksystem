import type {
  AgentInput,
  AgentResponse,
  IntentType,
  OrderItem,
  ToolsContext,
  AgentNodeState,
  PillarState,
} from "./types";
import { MemoryManager } from "./memory";
import {
  loadToolsContext,
  formatToolsForPrompt,
  findProductWithScore,
} from "./tools";

// ─── Prompt base del sistema ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sos un asistente de atención al cliente para un local de comida.
Respondés siempre en español, con tono amigable y directo.

REGLAS ESTRICTAS:
1. Respondés ÚNICAMENTE con un objeto JSON válido. Sin texto extra, sin markdown.
2. El JSON debe tener exactamente esta estructura:
{
  "intent": "ORDER" | "INFO" | "GREETING" | "CANCEL" | "FALLBACK",
  "response": "tu respuesta en lenguaje natural",
  "items": [{ "name": "nombre del producto", "qty": número }]
}
3. El campo "items" solo se incluye cuando hay productos en el pedido. En otros casos omitilo.
4. Si el cliente saluda, usá intent "GREETING".
5. Si pregunta sobre productos, precios u horarios, usá intent "INFO".
6. Si quiere cancelar, usá intent "CANCEL".
7. Si no entendés, usá intent "FALLBACK" y pedí aclaración amablemente.`;

// ─── Fallback de respuesta cuando el JSON falla ───────────────────────────────

const FALLBACK_RESPONSE: AgentResponse = {
  intent: "FALLBACK",
  response:
    "Perdón, tuve un problema procesando tu mensaje. ¿Podés repetirlo de otra manera?",
};

// ─── Parser JSON robusto (Pilar 3) ───────────────────────────────────────────

function parseAgentResponse(raw: string): AgentResponse {
  // Intento 1: parse directo
  try {
    const parsed = JSON.parse(raw);
    if (parsed.intent && parsed.response) return parsed as AgentResponse;
  } catch (_) {}

  // Intento 2: extraer bloque JSON con regex
  try {
    const match = raw.match(/\{[\s\S]*"intent"[\s\S]*"response"[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.intent && parsed.response) return parsed as AgentResponse;
    }
  } catch (_) {}

  // Intento 3: reparar JSON truncado
  try {
    let repaired = raw.trim();
    if (!repaired.endsWith("}")) repaired += '"}';
    const parsed = JSON.parse(repaired);
    if (parsed.intent && parsed.response) return parsed as AgentResponse;
  } catch (_) {}

  return FALLBACK_RESPONSE;
}

// ─── Resolvedor de productos (Pilar 4) ───────────────────────────────────────

function resolveItems(
  items: OrderItem[] | undefined,
  tools: ToolsContext
): OrderItem[] {
  if (!items || items.length === 0) return [];
  const products = tools.products ?? [];

  return items.map((item) => {
    const match = findProductWithScore(item.name, products);
    if (match && match.score > 0.15) {
      return {
        ...item,
        resolvedName: match.product.name,
        resolvedId: match.product.id,
        price: match.product.price,
      };
    }
    return item;
  });
}

// ─── AgentNode principal ──────────────────────────────────────────────────────

export class AgentNode {
  private memory = new MemoryManager();
  private onStateChange?: (state: AgentNodeState) => void;
  private currentState: AgentNodeState;

  constructor(onStateChange?: (state: AgentNodeState) => void) {
    this.onStateChange = onStateChange;
    this.currentState = this.buildInitialState();
  }

  private buildInitialState(): AgentNodeState {
    return {
      status: "idle",
      activeIntent: null,
      pillars: [
        { id: "capture",  label: "① Captura dinámica", sublabel: "texto ó transcripcion", status: "idle" },
        { id: "tools",    label: "② Superpoderes",     sublabel: "stock · pedidos · horarios", status: "idle" },
        { id: "json",     label: "③ Formato JSON",     sublabel: "intent · response · items", status: "idle" },
        { id: "resolver", label: "④ Resolución DB",    sublabel: "findProductWithScore", status: "idle" },
      ],
      lastResponse: null,
      memorySize: 0,
      toolsLoaded: false,
    };
  }

  private emit(partial: Partial<AgentNodeState>): void {
    this.currentState = { ...this.currentState, ...partial };
    this.onStateChange?.(this.currentState);
  }

  private setPillar(id: PillarState["id"], status: PillarState["status"]): void {
    const pillars = this.currentState.pillars.map((p) =>
      p.id === id ? { ...p, status } : p
    );
    this.emit({ pillars });
  }

  getState(): AgentNodeState {
    return this.currentState;
  }

  // ─── PIPELINE PRINCIPAL ──────────────────────────────────────────────────

  async process(input: AgentInput, apiKey: string): Promise<AgentResponse> {
    this.emit({ status: "processing", activeIntent: null });

    try {
      // ── Pilar 1: Captura dinámica ────────────────────────────────────────
      this.setPillar("capture", "processing");
      const userMessage = input.transcription ?? input.text ?? "";
      if (!userMessage.trim()) throw new Error("No hay mensaje de entrada");

      if (input.clientPhone) {
        this.memory.setClient(input.sessionId, input.clientPhone);
      }
      this.memory.append(input.sessionId, "user", userMessage);
      this.setPillar("capture", "success");

      // ── Pilar 2: Cargar tools / superpoderes ─────────────────────────────
      this.setPillar("tools", "processing");
      const memoryData = this.memory.get(input.sessionId);
      const toolsCtx = await loadToolsContext(memoryData.clientPhone);
      const toolsBlock = formatToolsForPrompt(toolsCtx);
      this.emit({ toolsLoaded: true });
      this.setPillar("tools", "success");

      // ── Construir prompt completo ─────────────────────────────────────────
      const historyBlock = this.memory.formatForPrompt(input.sessionId);
      const fullSystemPrompt = `${SYSTEM_PROMPT}

--- INFORMACIÓN ACTUAL DEL NEGOCIO ---
${toolsBlock}

--- HISTORIAL DE CONVERSACIÓN ---
${historyBlock || "(sin historial previo)"}`;

      // ── Llamar a la IA ───────────────────────────────────────────────────
      this.setPillar("json", "processing");
      const rawResponse = await this.callLLM(
        fullSystemPrompt,
        userMessage,
        apiKey
      );

      // ── Pilar 3: Parsear JSON estricto ───────────────────────────────────
      const parsed = parseAgentResponse(rawResponse);
      this.setPillar("json", parsed.intent === "FALLBACK" ? "error" : "success");

      // ── Pilar 4: Resolver productos contra DB ────────────────────────────
      this.setPillar("resolver", "processing");
      const resolvedItems = resolveItems(parsed.items, toolsCtx);
      const finalResponse: AgentResponse = {
        ...parsed,
        items: resolvedItems,
        rawJson: rawResponse,
      };
      this.setPillar("resolver", "success");

      // ── Guardar respuesta en memoria ─────────────────────────────────────
      this.memory.append(
        input.sessionId,
        "assistant",
        finalResponse.response,
        finalResponse.intent as IntentType
      );

      this.emit({
        status: "success",
        activeIntent: finalResponse.intent as IntentType,
        lastResponse: finalResponse,
        memorySize: this.memory.size(input.sessionId),
      });

      return finalResponse;
    } catch (error) {
      this.emit({ status: "error" });
      console.error("[AgentNode] Error:", error);
      return FALLBACK_RESPONSE;
    }
  }

  // ─── LLM call ────────────────────────────────────────────────────────────

  private async callLLM(
    systemPrompt: string,
    userMessage: string,
    apiKey: string
  ): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LLM API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const content = data.content as Array<{ type: string; text?: string }>;
    return content.find((b) => b.type === "text")?.text ?? "";
  }

  // ─── Utilidades ───────────────────────────────────────────────────────────

  clearSession(sessionId: string): void {
    this.memory.clear(sessionId);
    this.currentState = this.buildInitialState();
    this.emit(this.currentState);
  }
}
