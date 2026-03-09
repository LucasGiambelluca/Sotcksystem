require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const { data: flows, error } = await supabase.from('flows').select('*').eq('trigger_word', 'checkout_catalogo');
  if (error || !flows || flows.length === 0) return console.error("Flow not found", error);
  
  let flow = flows[0];
  let updated = false;

  const newNodes = flow.nodes.map(n => {
    if (n.id === 'node_pedir_direccion') {
      n.data.question = "Para calcular el costo de envío exacto y confirmar tu pedido, por favor envíanos tu 📍 *Ubicación de WhatsApp* (Tocá el 📎 clip naranja y luego 'Ubicación') o simplemente escribí tu dirección si preferís.";
      updated = true;
    }
    return n;
  });

  if (updated) {
    const { error: upErr } = await supabase.from('flows').update({ nodes: newNodes }).eq('id', flow.id);
    if (upErr) console.error("Error updating flow", upErr);
    else console.log("Flow updated perfectly for LIV Strategy!");
  }
}

main();
