-- Sample Flow: "Asistente Inteligente" using the groqNode
-- Trigger word: test-ia
-- This flow demonstrates how to use the Cerebro IA (Groq) node within a conversation flow.

INSERT INTO flows (name, trigger_word, is_active, nodes, edges) VALUES (
  'Asistente Inteligente',
  'test-ia',
  true,
  '[
    {
      "id": "start",
      "type": "input",
      "data": { "label": "Inicio (Palabra Clave: test-ia)" },
      "position": { "x": 250, "y": 5 },
      "style": { "background": "#22c55e", "color": "white", "border": "none", "fontWeight": "bold" }
    },
    {
      "id": "node_welcome",
      "type": "messageNode",
      "data": { "text": "👋 ¡Hola! Soy el asistente inteligente con IA.\n\nPodés preguntarme lo que quieras sobre nuestros productos, precios, o lo que necesites. ¡Estoy para ayudarte!" },
      "position": { "x": 550, "y": 5 }
    },
    {
      "id": "node_question",
      "type": "questionNode",
      "data": { "question": "¿Qué querés saber? Preguntame lo que quieras 😊", "variable": "user_input" },
      "position": { "x": 850, "y": 5 }
    },
    {
      "id": "node_groq",
      "type": "groqNode",
      "data": {
        "systemPrompt": "Sos el asistente virtual de una rotisería argentina. Respondé de forma amigable, breve y vendedora. Usá lenguaje argentino (che, genio, etc.). Si te preguntan por productos, consultá tu catálogo mental.",
        "prompt": "El cliente preguntó: {{user_input}}\n\nRespondé de forma natural y amigable.",
        "variable": "ai_response",
        "temperature": 0.7,
        "silent": false
      },
      "position": { "x": 1150, "y": 5 }
    },
    {
      "id": "node_followup",
      "type": "questionNode",
      "data": { "question": "¿Querés preguntarme algo más? Escribí tu pregunta o decí *chau* para terminar 👋", "variable": "user_input" },
      "position": { "x": 1450, "y": 5 }
    }
  ]'::jsonb,
  '[
    { "id": "e1", "source": "start", "target": "node_welcome", "animated": true },
    { "id": "e2", "source": "node_welcome", "target": "node_question", "animated": true },
    { "id": "e3", "source": "node_question", "target": "node_groq", "animated": true },
    { "id": "e4", "source": "node_groq", "target": "node_followup", "animated": true },
    { "id": "e5", "source": "node_followup", "target": "node_groq", "animated": true }
  ]'::jsonb
)
ON CONFLICT DO NOTHING;
