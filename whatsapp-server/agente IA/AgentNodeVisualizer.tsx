import React, { useCallback, useEffect, useRef, useState } from "react";
import type { AgentNodeState, AgentInput, AgentResponse, IntentType, PillarState } from "./types";
import { AgentNode } from "./AgentNode";

// ─── Color map por intent ────────────────────────────────────────────────────

const INTENT_COLORS: Record<IntentType, { bg: string; border: string; text: string }> = {
  ORDER:    { bg: "#E1F5EE", border: "#5DCAA5", text: "#085041" },
  INFO:     { bg: "#EEEDFE", border: "#AFA9EC", text: "#3C3489" },
  GREETING: { bg: "#EEEDFE", border: "#AFA9EC", text: "#3C3489" },
  CANCEL:   { bg: "#FAEEDA", border: "#FAC775", text: "#412402" },
  FALLBACK: { bg: "#FAECE7", border: "#F0997B", text: "#4A1B0C" },
};

const PILLAR_COLORS: Record<PillarState["id"], { bg: string; border: string; textMain: string; textSub: string }> = {
  capture:  { bg: "#EEEDFE", border: "#AFA9EC", textMain: "#3C3489", textSub: "#534AB7" },
  tools:    { bg: "#E1F5EE", border: "#5DCAA5", textMain: "#085041", textSub: "#0F6E56" },
  json:     { bg: "#FAEEDA", border: "#FAC775", textMain: "#412402", textSub: "#633806" },
  resolver: { bg: "#FAECE7", border: "#F0997B", textMain: "#4A1B0C", textSub: "#993C1D" },
};

const STATUS_GLOW: Record<PillarState["status"], string> = {
  idle:       "transparent",
  processing: "#7F77DD",
  success:    "#1D9E75",
  error:      "#D85A30",
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

interface PillarBoxProps {
  pillar: PillarState;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

const PillarBox: React.FC<PillarBoxProps> = ({ pillar, x, y, width = 136, height = 58 }) => {
  const c = PILLAR_COLORS[pillar.id];
  const glow = STATUS_GLOW[pillar.status];
  const cx = x + width / 2;
  return (
    <g>
      {pillar.status === "processing" && (
        <rect x={x - 2} y={y - 2} width={width + 4} height={height + 4}
          rx="10" fill="none" stroke={glow} strokeWidth="1.5" opacity="0.6"
          style={{ animation: "pulse 1.2s ease-in-out infinite" }} />
      )}
      <rect x={x} y={y} width={width} height={height} rx="8"
        fill={c.bg} stroke={c.border} strokeWidth="0.5" />
      <text x={cx} y={y + 20} textAnchor="middle" dominantBaseline="central"
        fontSize="11" fontWeight="500" fill={c.textMain}>{pillar.label}</text>
      <text x={cx} y={y + 36} textAnchor="middle" dominantBaseline="central"
        fontSize="9.5" fontWeight="400" fill={c.textSub}>{pillar.sublabel}</text>
      {pillar.status === "success" && (
        <circle cx={x + width - 10} cy={y + 10} r="4" fill="#1D9E75" />
      )}
      {pillar.status === "error" && (
        <circle cx={x + width - 10} cy={y + 10} r="4" fill="#D85A30" />
      )}
    </g>
  );
};

// ─── Main visual component ───────────────────────────────────────────────────

interface AgentNodeVisualizerProps {
  state: AgentNodeState;
  onSendMessage?: (msg: string) => void;
}

export const AgentNodeVisualizer: React.FC<AgentNodeVisualizerProps> = ({ state, onSendMessage }) => {
  const isActive = state.status === "processing";

  const flowStyle = (active: boolean): React.CSSProperties => ({
    strokeDasharray: "6 4",
    animation: active ? "flow 0.8s linear infinite" : undefined,
    opacity: active ? 1 : 0.35,
  });

  return (
    <svg
      width="100%"
      viewBox="0 0 680 620"
      aria-label="Agente IA — diagrama de nodo"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        <style>{`
          @keyframes flow { to { stroke-dashoffset: -20; } }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
          @keyframes blink { 0%,60%{opacity:1} 61%,100%{opacity:0} }
          .clickable { cursor: pointer; }
          .clickable:hover rect { opacity: 0.85; }
        `}</style>
      </defs>

      {/* ── Entradas ── */}
      {/* Audio/Texto */}
      <g className="clickable" onClick={() => onSendMessage?.("¿Cómo funciona la captura dinámica?")}>
        <rect x="22" y="80" width="108" height="44" rx="8" fill="none"
          stroke={isActive ? "#7F77DD" : "#B4B2A9"} strokeWidth="0.5" />
        <text x="76" y="98" textAnchor="middle" dominantBaseline="central"
          fontSize="12" fontWeight="500" fill="#3C3489">Audio / Texto</text>
        <text x="76" y="114" textAnchor="middle" dominantBaseline="central"
          fontSize="10" fill="#534AB7">transcripcion var</text>
        <circle cx="130" cy="102" r="5" fill="#7F77DD" />
      </g>

      {/* Memoria */}
      <g className="clickable" onClick={() => onSendMessage?.("¿Cómo se integra la memoria con el agente?")}>
        <rect x="22" y="148" width="108" height="44" rx="8" fill="none"
          stroke={state.memorySize > 0 ? "#1D9E75" : "#B4B2A9"} strokeWidth="0.5" />
        <text x="76" y="166" textAnchor="middle" dominantBaseline="central"
          fontSize="12" fontWeight="500" fill="#085041">Memoria</text>
        <text x="76" y="182" textAnchor="middle" dominantBaseline="central"
          fontSize="10" fill="#0F6E56">{state.memorySize} entradas</text>
        <circle cx="130" cy="170" r="5" fill="#1D9E75" />
      </g>

      {/* Cliente */}
      <g className="clickable" onClick={() => onSendMessage?.("¿Qué datos del cliente recibe el agente?")}>
        <rect x="22" y="216" width="108" height="44" rx="8" fill="none"
          stroke="#B4B2A9" strokeWidth="0.5" />
        <text x="76" y="234" textAnchor="middle" dominantBaseline="central"
          fontSize="12" fontWeight="500" fill="#412402">Cliente</text>
        <text x="76" y="250" textAnchor="middle" dominantBaseline="central"
          fontSize="10" fill="#633806">teléfono + datos</text>
        <circle cx="130" cy="238" r="5" fill="#BA7517" />
      </g>

      {/* Flechas de entrada */}
      <path d="M130 102 L180 170" fill="none" stroke="#7F77DD" strokeWidth="1.5"
        markerEnd="url(#arr)" style={flowStyle(isActive)} />
      <path d="M130 170 L180 200" fill="none" stroke="#1D9E75" strokeWidth="1.5"
        markerEnd="url(#arr)" style={flowStyle(isActive && state.memorySize > 0)} />
      <path d="M130 238 L180 230" fill="none" stroke="#BA7517" strokeWidth="1.5"
        markerEnd="url(#arr)" style={flowStyle(isActive)} />

      {/* ── Nodo Principal ── */}
      {/* Borde externo con glow cuando activo */}
      <rect x="178" y="88" width="324" height="284" rx="16" fill="none"
        stroke="#7F77DD" strokeWidth={isActive ? "1.5" : "0.5"} opacity={isActive ? 0.6 : 0.2} />
      <rect x="180" y="90" width="320" height="280" rx="14"
        fill="var(--bg, #fff)" stroke="#B4B2A9" strokeWidth="0.5" />

      {/* Header */}
      <rect x="180" y="90" width="320" height="46" rx="14" fill="#EEEDFE" opacity="0.7" />
      <rect x="180" y="118" width="320" height="18" fill="#EEEDFE" opacity="0.7" />

      {/* Ícono cerebro (formas simples) */}
      <circle cx="207" cy="113" r="10" fill="none" stroke="#534AB7" strokeWidth="1.5" />
      <path d="M203 113 Q205 108 210 110 Q212 105 216 108 Q218 113 214 116 Q210 120 206 117 Z"
        fill="#534AB7" opacity="0.35" />

      <text x="224" y="108" dominantBaseline="central" fontSize="13"
        fontWeight="500" fill="#3C3489">Agente IA</text>
      <text x="224" y="124" dominantBaseline="central" fontSize="10"
        fill="#534AB7">Orquestador · Decisor · Respondedor</text>

      {/* Badge activo */}
      <rect x="446" y="98" width="44" height="18" rx="9"
        fill="#EEEDFE" stroke="#534AB7" strokeWidth="0.5" />
      <circle cx="458" cy="107" r="3" fill={isActive ? "#1D9E75" : "#888780"}
        style={isActive ? { animation: "pulse 1.5s ease-in-out infinite" } : undefined} />
      <text x="464" y="108" fontSize="9" fill="#534AB7" dominantBaseline="central">
        {isActive ? "activo" : "idle"}
      </text>

      {/* Puerto entrada */}
      <circle cx="180" cy="200" r="5" fill="white" stroke="#7F77DD" strokeWidth="1.5" />

      {/* ── Pilares ── */}
      {state.pillars.map((p, i) => {
        const row = Math.floor(i / 2);
        const col = i % 2;
        return (
          <PillarBox
            key={p.id}
            pillar={p}
            x={196 + col * 152}
            y={144 + row * 74}
          />
        );
      })}

      {/* Flecha interna entre pilares */}
      <path d="M332 173 L348 173" fill="none" stroke="#888780" strokeWidth="0.5" markerEnd="url(#arr)" />
      <path d="M332 247 L348 247" fill="none" stroke="#888780" strokeWidth="0.5" markerEnd="url(#arr)" />

      {/* Puerto salida */}
      <circle cx="500" cy="200" r="5" fill="#7F77DD" />

      {/* ── Intent Router (diamante) ── */}
      <polygon points="340,298 366,320 340,342 314,320"
        fill="var(--bg, #fff)" stroke="#7F77DD" strokeWidth={isActive ? "1.5" : "1"} />
      <text x="340" y="316" textAnchor="middle" dominantBaseline="central"
        fontSize="9" fill="#534AB7">intent</text>
      <text x="340" y="328" textAnchor="middle" dominantBaseline="central"
        fontSize="9" fill="#534AB7">router</text>

      {/* ── Ramas de salida ── */}
      {/* ORDER */}
      <path d="M366 320 L500 320 L500 370" fill="none" stroke="#1D9E75" strokeWidth="1.5"
        markerEnd="url(#arr)"
        style={flowStyle(state.activeIntent === "ORDER")} />
      <g className="clickable" onClick={() => onSendMessage?.("¿Cómo maneja el agente los pedidos?")}>
        <rect x="440" y="370" width="120" height="40" rx="8"
          fill={state.activeIntent === "ORDER" ? "#E1F5EE" : "var(--bg, #fff)"}
          stroke="#5DCAA5" strokeWidth={state.activeIntent === "ORDER" ? "1.5" : "0.5"} />
        <text x="500" y="386" textAnchor="middle" dominantBaseline="central"
          fontSize="11" fontWeight="500" fill="#085041">ORDER</text>
        <text x="500" y="400" textAnchor="middle" dominantBaseline="central"
          fontSize="9.5" fill="#0F6E56">Registrar pedido</text>
      </g>

      {/* INFO / GREETING */}
      <path d="M340 342 L340 370" fill="none" stroke="#7F77DD" strokeWidth="1.5"
        markerEnd="url(#arr)"
        style={flowStyle(state.activeIntent === "INFO" || state.activeIntent === "GREETING")} />
      <g className="clickable" onClick={() => onSendMessage?.("¿Cómo responde el agente consultas de información?")}>
        <rect x="280" y="370" width="120" height="40" rx="8"
          fill={state.activeIntent === "INFO" || state.activeIntent === "GREETING" ? "#EEEDFE" : "var(--bg, #fff)"}
          stroke="#AFA9EC" strokeWidth={state.activeIntent === "INFO" ? "1.5" : "0.5"} />
        <text x="340" y="386" textAnchor="middle" dominantBaseline="central"
          fontSize="11" fontWeight="500" fill="#3C3489">INFO</text>
        <text x="340" y="400" textAnchor="middle" dominantBaseline="central"
          fontSize="9.5" fill="#534AB7">Responder consulta</text>
      </g>

      {/* FALLBACK */}
      <path d="M314 320 L180 320 L180 370" fill="none" stroke="#D85A30" strokeWidth="1.5"
        markerEnd="url(#arr)"
        style={flowStyle(state.activeIntent === "FALLBACK")} />
      <g className="clickable" onClick={() => onSendMessage?.("¿Qué hace el sistema cuando el JSON falla?")}>
        <rect x="120" y="370" width="120" height="40" rx="8"
          fill={state.activeIntent === "FALLBACK" ? "#FAECE7" : "var(--bg, #fff)"}
          stroke="#F0997B" strokeWidth={state.activeIntent === "FALLBACK" ? "1.5" : "0.5"} />
        <text x="180" y="386" textAnchor="middle" dominantBaseline="central"
          fontSize="11" fontWeight="500" fill="#4A1B0C">FALLBACK</text>
        <text x="180" y="400" textAnchor="middle" dominantBaseline="central"
          fontSize="9.5" fill="#993C1D">Reparar / predefinido</text>
      </g>

      {/* ── Memory feedback loop ── */}
      <path d="M340 410 L340 450 L76 450 L76 192" fill="none"
        stroke="#1D9E75" strokeWidth="1" strokeDasharray="4 3"
        markerEnd="url(#arr)" opacity="0.55" />
      <text x="200" y="462" textAnchor="middle" fontSize="9"
        fill="#0F6E56" opacity="0.8">actualiza memoria</text>

      {/* ── Tools externas ── */}
      {["Stock DB", "Pedidos DB", "Horarios"].map((label, i) => (
        <g key={label} className="clickable"
          onClick={() => onSendMessage?.(`¿Cómo usa el agente ${label}?`)}>
          <rect x={180 + i * 116} y="490" width="88" height="36" rx="8"
            fill={state.toolsLoaded ? "#F1EFE8" : "var(--bg, #fff)"}
            stroke="#B4B2A9" strokeWidth="0.5" />
          <text x={180 + i * 116 + 44} y="504" textAnchor="middle"
            dominantBaseline="central" fontSize="10" fontWeight="500"
            fill="#2C2C2A">{label}</text>
          <text x={180 + i * 116 + 44} y="518" textAnchor="middle"
            dominantBaseline="central" fontSize="9" fill="#5F5E5A">
            {["productos", "último pedido", "abierto/cerrado"][i]}
          </text>
        </g>
      ))}

      {/* Flechas tools -> nodo (punteadas hacia arriba) */}
      {[224, 340, 456].map((x) => (
        <path key={x} d={`M${x} 490 L${x} 460 L416 460 L416 202`}
          fill="none" stroke="#BA7517" strokeWidth="0.5"
          strokeDasharray="3 3" markerEnd="url(#arr)" opacity="0.4" />
      ))}
      <text x="340" y="475" textAnchor="middle" fontSize="9"
        fill="#888780">inyectadas al prompt</text>

      {/* ── Output ── */}
      <path d="M500 390 L590 390" fill="none" stroke="#1D9E75" strokeWidth="1.5"
        markerEnd="url(#arr)" style={flowStyle(state.status === "success")} />
      <g className="clickable" onClick={() => onSendMessage?.("¿Qué formato tiene la respuesta final del agente?")}>
        <rect x="590" y="370" width="78" height="40" rx="8"
          fill={state.status === "success" ? "#E1F5EE" : "var(--bg, #fff)"}
          stroke="#5DCAA5" strokeWidth="0.5" />
        <text x="629" y="385" textAnchor="middle" dominantBaseline="central"
          fontSize="10" fontWeight="500" fill="#085041">Respuesta</text>
        <text x="629" y="400" textAnchor="middle" dominantBaseline="central"
          fontSize="9" fill="#0F6E56">JSON válido</text>
      </g>

      {/* ── Última respuesta inline ── */}
      {state.lastResponse && (
        <g>
          <rect x="22" y="540" width="636" height="64" rx="8"
            fill={INTENT_COLORS[state.lastResponse.intent].bg}
            stroke={INTENT_COLORS[state.lastResponse.intent].border}
            strokeWidth="0.5" />
          <text x="40" y="557" fontSize="9" fontWeight="500"
            fill={INTENT_COLORS[state.lastResponse.intent].text}>
            {state.lastResponse.intent}
          </text>
          <text x="40" y="573" fontSize="10"
            fill={INTENT_COLORS[state.lastResponse.intent].text}>
            {state.lastResponse.response.slice(0, 88)}
            {state.lastResponse.response.length > 88 ? "…" : ""}
          </text>
          {state.lastResponse.items && state.lastResponse.items.length > 0 && (
            <text x="40" y="591" fontSize="9" fill={INTENT_COLORS[state.lastResponse.intent].text} opacity="0.8">
              Items: {state.lastResponse.items.map(i => `${i.qty}× ${i.resolvedName ?? i.name}`).join(" · ")}
            </text>
          )}
        </g>
      )}
    </svg>
  );
};

// ─── Hook para usar el AgentNode ──────────────────────────────────────────────

export function useAgentNode(apiKey: string) {
  const nodeRef = useRef<AgentNode | null>(null);
  const [state, setState] = useState<AgentNodeState>({
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
  });

  useEffect(() => {
    nodeRef.current = new AgentNode((s) => setState({ ...s }));
  }, []);

  const sendMessage = useCallback(
    async (input: AgentInput): Promise<AgentResponse | null> => {
      if (!nodeRef.current) return null;
      return nodeRef.current.process(input, apiKey);
    },
    [apiKey]
  );

  const clearSession = useCallback((sessionId: string) => {
    nodeRef.current?.clearSession(sessionId);
  }, []);

  return { state, sendMessage, clearSession };
}
