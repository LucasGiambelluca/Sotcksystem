require('ts-node').register();
const { supabase } = require('./src/config/database');

const FLOW_ID = '2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b';
const FLOW_NAME = '🤖 Vendedor Autónomo IA';

// ═══════════════════════════════════════════════
// NODOS DEL FLUJO — Arquitectura del Video David Soler
// ═══════════════════════════════════════════════
const nodes = [
  // ── ENTRADA GLOBAL ──────────────────────────
  {
    id: 'n_hook', type: 'webhookNode',
    data: { label: '📥 Entrada WhatsApp' },
    position: { x: 50, y: 200 }
  },

  // ── DETECTOR DE MEDIA ────────────────────────
  {
    id: 'n_media', type: 'mediaTypeDetectorNode',
    data: { label: '🔍 ¿Audio o Texto?' },
    position: { x: 300, y: 200 }
  },

  // ── TRANSCRIPCIÓN DE AUDIO ───────────────────
  {
    id: 'n_audio', type: 'audioTranscriberNode',
    data: { label: '🎙️ Transcribir Audio', variable: 'user_message' },
    position: { x: 550, y: 80 }
  },

  // ── MEMORIA (Buffer Memory) ──────────────────
  {
    id: 'n_memory', type: 'bufferMemoryNode',
    data: { label: '🧠 Pila Memoria', capacity: 12 },
    position: { x: 800, y: 200 }
  },

  // ── HORARIO DE ATENCIÓN ──────────────────────
  {
    id: 'n_hours', type: 'businessHoursNode',
    data: { label: '🕐 Horario' },
    position: { x: 1050, y: 200 }
  },

  // ── MENSAJE FUERA DE HORARIO ─────────────────
  {
    id: 'n_closed', type: 'messageNode',
    data: {
      label: '😴 Fuera de Horario',
      text: '¡Hola! Estamos cerrados por ahora. Nuestro horario es de 11:00 a 22:00. ¡Te esperamos mañana! 🍗'
    },
    position: { x: 1050, y: 50 }
  },

  // ── CEREBRO AGENTE IA ────────────────────────
  {
    id: 'n_agent', type: 'aiAgentNode',
    data: {
      label: '🤖 Agente Vendedor',
      include_catalog: true,
      include_history: true,
      include_cart: true,
      tools: { tool_stock: true, tool_orders: true, tool_hours: false },
      possible_intents: 'pedido,consulta,saludo,checkout,cancelar,asesor,desconocido',
      output_variable: 'intent',
      system_prompt: `Sos el asistente de ventas de "El Pollo Comilón", una rotisería en Bahía Blanca.
Tu misión: atender clientes de manera cálida, eficiente y profesional.

COMPORTAMIENTO:
- Saludá con calidez pero sé breve. No hagas preguntas innecesarias.
- Si el cliente pide algo, confirmalo claramente mencionando producto, cantidad y precio.
- Usá el catálogo adjunto para informar precios y disponibilidad.
- Si pregunta por su pedido, usá los datos de "ÚLTIMO PEDIDO" que tenés disponibles.
- Si no podés ayudar, derivá a un asesor humano.

REGLAS DE MEMORIA:
- Todo lo que esté en el CARRITO ACTUAL debe mantenerse salvo que el cliente pida cambios.
- Si el cliente confirma (sí, dale, perfecto), el pedido está listo para cerrar.`
    },
    position: { x: 1300, y: 200 }
  },

  // ── RAMAS DE INTENCIÓN ───────────────────────
  {
    id: 'n_msg_order', type: 'messageNode',
    data: { label: '🛒 Confirmar Pedido', text: '{{intent_response}}' },
    position: { x: 1600, y: 0 }
  },
  {
    id: 'n_msg_consult', type: 'messageNode',
    data: { label: '💬 Respuesta', text: '{{intent_response}}' },
    position: { x: 1600, y: 130 }
  },
  {
    id: 'n_msg_saludo', type: 'messageNode',
    data: { label: '👋 Saludo', text: '{{intent_response}}' },
    position: { x: 1600, y: 260 }
  },
  {
    id: 'n_checkout', type: 'orderValidatorNode',
    data: { label: '✅ Validar Pedido Final' },
    position: { x: 1600, y: 390 }
  },
  {
    id: 'n_cancel', type: 'clearCartNode',
    data: { label: '🗑️ Cancelar Pedido' },
    position: { x: 1600, y: 520 }
  },
  {
    id: 'n_handover', type: 'handoverNode',
    data: { label: '👨‍💼 Asesor Humano', message: 'Un momento, te comunico con un asesor.' },
    position: { x: 1600, y: 650 }
  },

  // ── CREAR PEDIDO ─────────────────────────────
  {
    id: 'n_create_order', type: 'createOrderNode',
    data: { label: '📦 Crear Pedido', send_confirmation: true },
    position: { x: 1900, y: 390 }
  },
  {
    id: 'n_order_confirm', type: 'messageNode',
    data: { label: '✅ Confirmación', text: '¡Pedido registrado! 🎉\n\n📋 *Resumen:*\n{{intent_items}}\n\n💰 Total: ${{cart_total}}\n\n¡Estamos preparándolo! ⏳' },
    position: { x: 2200, y: 390 }
  },
  {
    id: 'n_cancel_msg', type: 'messageNode',
    data: { label: '👋 Hasta luego', text: 'Pedido cancelado. ¡Cuando quieras volver a pedir, acá estamos! 🤜🤛' },
    position: { x: 1900, y: 520 }
  }
];

// ═══════════════════════════════════════════════
// ARISTAS (CONEXIONES)
// ═══════════════════════════════════════════════
const edges = [
  // Entrada → Detector
  { id: 'e1', source: 'n_hook', target: 'n_media' },

  // Detector → según tipo
  { id: 'e2', source: 'n_media', target: 'n_audio', sourceHandle: 'audio' },
  { id: 'e3', source: 'n_media', target: 'n_memory', sourceHandle: 'text' },
  { id: 'e4', source: 'n_audio', target: 'n_memory' },

  // Memoria → Horario
  { id: 'e5', source: 'n_memory', target: 'n_hours' },

  // Horario
  { id: 'e6', source: 'n_hours', target: 'n_closed', sourceHandle: 'closed' },
  { id: 'e7', source: 'n_hours', target: 'n_agent', sourceHandle: 'open' },

  // Agente → ramas por intención
  { id: 'e8',  source: 'n_agent', target: 'n_msg_order',   sourceHandle: 'pedido' },
  { id: 'e9',  source: 'n_agent', target: 'n_msg_consult',  sourceHandle: 'consulta' },
  { id: 'e10', source: 'n_agent', target: 'n_msg_saludo',   sourceHandle: 'saludo' },
  { id: 'e11', source: 'n_agent', target: 'n_checkout',     sourceHandle: 'checkout' },
  { id: 'e12', source: 'n_agent', target: 'n_cancel',       sourceHandle: 'cancelar' },
  { id: 'e13', source: 'n_agent', target: 'n_handover',     sourceHandle: 'asesor' },
  { id: 'e14', source: 'n_agent', target: 'n_msg_consult',  sourceHandle: 'desconocido' },

  // Checkout → Crear Pedido → Confirmación
  { id: 'e15', source: 'n_checkout',       target: 'n_create_order' },
  { id: 'e16', source: 'n_create_order',   target: 'n_order_confirm' },

  // Cancelar → Mensaje
  { id: 'e17', source: 'n_cancel', target: 'n_cancel_msg' },
];

async function createSalesAgentFlow() {
  console.log(`🚀 Insertando flujo: "${FLOW_NAME}"...`);

  const { error } = await supabase.from('flows').upsert({
    id: FLOW_ID,
    name: FLOW_NAME,
    description: '🤖 Agente de ventas autónomo. Maneja texto + audio, memoria, horarios y cierre de pedidos.',
    is_active: true,
    nodes,
    edges
  });

  if (error) {
    console.error('❌ Error:', error.message);
  } else {
    console.log(`✅ Flujo "${FLOW_NAME}" insertado con éxito!`);
    console.log(`   → ${nodes.length} nodos, ${edges.length} conexiones`);
    console.log('   → Abrí el Bot Builder para verlo 🎉');
  }

  process.exit(0);
}

createSalesAgentFlow();
