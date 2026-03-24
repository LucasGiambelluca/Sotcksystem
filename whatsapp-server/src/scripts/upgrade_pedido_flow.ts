import { supabase } from '../config/database';

async function upgradeFlow() {
  const flowId = 'd7f26b46-2ac6-48bc-ad4e-6547dba77e20';

  const { data: flow, error: fetchErr } = await supabase.from('flows').select('*').eq('id', flowId).single();
  
  if (fetchErr) {
    console.error("Error fetching flow:", fetchErr);
    return;
  }

  const newNodes = [
    {
      id: 'start',
      type: 'input',
      data: { label: 'Inicio (Palabra Clave: pedido)' },
      position: { x: 100, y: 100 }
    },
    {
      id: 'n_welcome_pedido',
      type: 'messageNode',
      data: {
        text: "¡Hola! 🍗\n\nPodés armar tu pedido súper rápido desde nuestro menú online:\n👉 *https://localhost:5173/elpollocomilon/pedir*\n\nO si preferís, podés escribirme por acá qué te gustaría pedir (ej: *\"quiero 1 pollo y 2 ensaladas\"*). ¡Te leo!"
      },
      position: { x: 100, y: 250 }
    },
    // The rest of the nodes are for the Checkout phase (jumped to programmatically)
    {
      id: 'n_ask_delivery',
      type: 'pollNode',
      data: {
        question: '¿Cómo lo querés?',
        options: ['🏠 Delivery', '📦 Retiro en el local'],
        variable: 'envio_opcion'
      },
      position: { x: 400, y: 100 }
    },
    {
      id: 'n_cond_delivery',
      type: 'conditionNode',
      data: {
        variable: 'envio_opcion',
        operator: 'equals',
        expectedValue: '1' // Si eligió Delivery (opcion 1)
      },
      position: { x: 400, y: 250 }
    },
    {
      id: 'n_ask_address',
      type: 'questionNode',
      data: {
        question: '¿A qué dirección te lo mandamos? 📍',
        variable: 'direccion_cliente'
      },
      position: { x: 250, y: 400 }
    },
    {
      id: 'n_ask_payment',
      type: 'pollNode',
      data: {
        question: '¿Cómo preferís abonar? 💳',
        options: ['💵 Efectivo', '🏦 Transferencia / MercadoPago'],
        variable: 'metodo_pago'
      },
      position: { x: 400, y: 550 }
    },
    {
      id: 'n_final',
      type: 'createOrderNode',
      data: { label: 'Crear Pedido' },
      position: { x: 400, y: 700 }
    }
  ];

  const newEdges = [
    { id: 'e1', source: 'start', target: 'n_welcome_pedido', sourceHandle: 'default', targetHandle: 'default' },
    // Notice n_welcome_pedido has no outgoing edges. The flow stops there and waits for the user to write their order globally.
    
    // Delivery Logic
    { id: 'e2', source: 'n_ask_delivery', target: 'n_cond_delivery', sourceHandle: 'default', targetHandle: 'default' },
    { id: 'e3', source: 'n_cond_delivery', target: 'n_ask_address', sourceHandle: 'yes', targetHandle: 'default' }, // Delivery -> Pide dirección
    { id: 'e4', source: 'n_cond_delivery', target: 'n_ask_payment', sourceHandle: 'no', targetHandle: 'default' }, // Retiro -> Salta a pago
    { id: 'e5', source: 'n_ask_address', target: 'n_ask_payment', sourceHandle: 'default', targetHandle: 'default' },
    { id: 'e6', source: 'n_ask_payment', target: 'n_final', sourceHandle: 'default', targetHandle: 'default' }
  ];

  const { error: updateErr } = await supabase
    .from('flows')
    .update({ nodes: newNodes, edges: newEdges })
    .eq('id', flowId);

  if (updateErr) {
    console.error("Error updating flow:", updateErr);
  } else {
    console.log("Flow 'Tomar Pedido' updated successfully! It is now flexible.");
  }
}

upgradeFlow();

