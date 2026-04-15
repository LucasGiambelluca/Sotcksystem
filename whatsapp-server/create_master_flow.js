require('ts-node').register();
const { supabase } = require('./src/config/database');

const flowName = "Agente IA Mejorado";
const flowId = "1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a";

const nodes = [
  { id: 'node_hook', type: 'webhookNode', data: { label: 'Entrada Global' }, position: { x: 50, y: 150 } },
  { id: 'node_detector', type: 'mediaTypeDetectorNode', data: { label: 'Audio o Texto?' }, position: { x: 300, y: 150 } },
  { id: 'node_transcriber', type: 'audioToTextNode', data: { label: 'Transcripción', variable: 'transcripcion' }, position: { x: 550, y: 50 } },
  { id: 'node_memory', type: 'bufferMemoryNode', data: { label: 'Pila Memoria', capacity: 10 }, position: { x: 800, y: 150 } },
  { id: 'node_agent', type: 'aiAgentNode', data: { 
      label: 'Agente Cerebro', 
      system_prompt: 'Eres un asistente experto en comida rápida. Ayuda al cliente cordialmenete.',
      possible_intents: 'pedido,consulta,cancelar,asesor,saludo,desconocido'
    }, position: { x: 1100, y: 150 } 
  },
  // Respuestas dinámicas basadas en la intención
  { id: 'node_msg_pedido', type: 'messageNode', data: { label: 'Confirmar Pedido', text: '¡Anotado! 📝 Entendí esto: {{agent_intent_items}}. ¿Confirmamos?' }, position: { x: 1450, y: 0 } },
  { id: 'node_msg_consulta', type: 'messageNode', data: { label: 'Responder Consulta', text: '{{agent_intent_response}}' }, position: { x: 1450, y: 150 } },
  { id: 'node_handover', type: 'handoverNode', data: { label: 'Avisar Humano', message: 'Un asesor se pondrá en contacto contigo a la brevedad.' }, position: { x: 1450, y: 300 } },
  { id: 'node_msg_cancel', type: 'messageNode', data: { label: 'Limpiar Todo', text: 'De acuerdo, borré todo. ¿En qué más puedo ayudarte?' }, position: { x: 1450, y: 450 } }
];

const edges = [
  { id: 'e1', source: 'node_hook', target: 'node_detector' },
  { id: 'e2', source: 'node_detector', target: 'node_transcriber', sourceHandle: 'audio' },
  { id: 'e3', source: 'node_detector', target: 'node_memory', sourceHandle: 'text' },
  { id: 'e4', source: 'node_transcriber', target: 'node_memory' },
  { id: 'e5', source: 'node_memory', target: 'node_agent' },
  // Ramificación por intención
  { id: 'e6', source: 'node_agent', target: 'node_msg_pedido', sourceHandle: 'pedido' },
  { id: 'e7', source: 'node_agent', target: 'node_msg_consulta', sourceHandle: 'consulta' },
  { id: 'e8', source: 'node_agent', target: 'node_msg_consulta', sourceHandle: 'saludo' },
  { id: 'e9', source: 'node_agent', target: 'node_handover', sourceHandle: 'asesor' },
  { id: 'e10', source: 'node_agent', target: 'node_msg_cancel', sourceHandle: 'cancelar' }
];

async function createMasterFlow() {
  console.log('🚀 Creando el Flujo Maestro: Agente IA Mejorado...');
  
  const { data, error } = await supabase.from('flows').upsert({
    id: flowId,
    name: flowName,
    description: "Flujo inteligente con detección de audio, memoria y soporte humano.",
    is_active: true,
    nodes: nodes,
    edges: edges
  });

  if (error) {
    console.error('❌ Error creando el flujo:', error);
  } else {
    console.log('✅ ¡Flujo creado con éxito! Ya puedes verlo en el Bot Builder.');
  }
}

createMasterFlow();
