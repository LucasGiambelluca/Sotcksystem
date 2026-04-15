import React, { useState, useRef } from "react";
import { AgentNodeVisualizer, useAgentNode } from "./AgentNodeVisualizer";
import type { AgentInput } from "./types";

const SESSION_ID = "demo-session-001";

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const { state, sendMessage, clearSession } = useAgentNode(apiKey);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = async (text?: string) => {
    const content = text ?? message.trim();
    if (!content || !apiKey) return;

    setMessage("");
    setLog((prev) => [...prev, `➤ ${content}`]);

    const input: AgentInput = {
      text: content,
      sessionId: SESSION_ID,
      clientPhone: "5491112345678",
    };

    const response = await sendMessage(input);
    if (response) {
      setLog((prev) => [
        ...prev,
        `[${response.intent}] ${response.response}`,
      ]);
    }

    inputRef.current?.focus();
  };

  const handleClear = () => {
    clearSession(SESSION_ID);
    setLog([]);
  };

  return (
    <div style={{ display: "flex", gap: 24, padding: 24, minHeight: "100vh",
      fontFamily: "system-ui, sans-serif", background: "#f8f7f5" }}>

      {/* Panel izquierdo: diagrama */}
      <div style={{ flex: "0 0 520px", background: "#fff", borderRadius: 12,
        border: "0.5px solid #d3d1c7", padding: 16 }}>
        <AgentNodeVisualizer
          state={state}
          onSendMessage={(msg) => handleSend(msg)}
        />
      </div>

      {/* Panel derecho: chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* API Key */}
        <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #d3d1c7", padding: 16 }}>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>
            Anthropic API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8,
              border: "0.5px solid #d3d1c7", fontSize: 14, boxSizing: "border-box" }}
          />
        </div>

        {/* Estado del nodo */}
        <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #d3d1c7",
          padding: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "Estado", value: state.status },
            { label: "Intent", value: state.activeIntent ?? "—" },
            { label: "Memoria", value: `${state.memorySize} msgs` },
            { label: "Tools", value: state.toolsLoaded ? "✓ cargadas" : "pendiente" },
          ].map((m) => (
            <div key={m.label} style={{ flex: 1, minWidth: 80, background: "#f8f7f5",
              borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Log de mensajes */}
        <div style={{ flex: 1, background: "#fff", borderRadius: 12,
          border: "0.5px solid #d3d1c7", padding: 16, overflow: "auto" }}>
          {log.length === 0 ? (
            <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", marginTop: 40 }}>
              Enviá un mensaje para empezar
            </p>
          ) : (
            log.map((line, i) => (
              <div key={i} style={{
                padding: "6px 0",
                borderBottom: "0.5px solid #f0ede8",
                fontSize: 13,
                color: line.startsWith("➤") ? "#3C3289" : "#2C2C2A",
                fontWeight: line.startsWith("➤") ? 500 : 400,
              }}>{line}</div>
            ))
          )}
        </div>

        {/* Input */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Escribí tu mensaje..."
            style={{ flex: 1, padding: "10px 14px", borderRadius: 8,
              border: "0.5px solid #d3d1c7", fontSize: 14 }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!message.trim() || !apiKey || state.status === "processing"}
            style={{ padding: "10px 20px", borderRadius: 8, border: "none",
              background: "#534AB7", color: "#fff", fontSize: 14, cursor: "pointer",
              opacity: state.status === "processing" ? 0.6 : 1 }}
          >
            {state.status === "processing" ? "..." : "Enviar"}
          </button>
          <button
            onClick={handleClear}
            style={{ padding: "10px 16px", borderRadius: 8,
              border: "0.5px solid #d3d1c7", background: "#fff",
              fontSize: 14, cursor: "pointer", color: "#888" }}
          >
            Limpiar
          </button>
        </div>

        {/* Mensajes de prueba rápida */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            "Hola! quiero hacer un pedido",
            "2 empanadas de carne y una coca",
            "¿tienen stock de sanguches?",
            "¿a qué hora cierran?",
          ].map((q) => (
            <button key={q} onClick={() => handleSend(q)} disabled={!apiKey}
              style={{ padding: "6px 12px", borderRadius: 20, border: "0.5px solid #AFA9EC",
                background: "#EEEDFE", color: "#3C3289", fontSize: 12, cursor: "pointer" }}>
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
