export const NAV_LINKS = [
  { label: 'Funciones', href: '#funciones' },
  { label: 'Demo', href: '#demo' },
  { label: 'Precios', href: '#precios' },
];

export const HERO = {
  title: 'Automatizá tu local con WhatsApp',
  subtitle: 'Tus clientes piden, el bot gestiona, vos recibís la comanda. Sin errores, sin esperas.',
  stats: [
    { value: '90%', label: 'pedidos automáticos' },
    { value: '24/7', label: 'atención del bot' },
    { value: '0', label: 'errores de carga' },
  ],
};

export const FEATURES = [
  { icon: 'Bot', title: 'Bot Inteligente', desc: 'Atención automática por WhatsApp los 365 días del año.' },
  { icon: 'Monitor', title: 'Panel Simple', desc: 'Gestioná pedidos y stock desde cualquier dispositivo.' },
  { icon: 'Printer', title: 'Comandas', desc: 'Impresión automática de tickets para cocina y delivery.' },
  { icon: 'FlaskConical', title: 'Stock y Recetas', desc: 'Control de insumos y producción en tiempo real.' },
];

export const TESTIMONIALS = [
  { quote: 'Desde que instalamos Sotcksystem, el bot atiende el 90% de los pedidos sin que tengamos que tocar el teléfono. Me cambió la vida en la cocina.', name: 'Carlos M.', role: 'Pizzería La Nonna', initials: 'CM' },
  { quote: 'Lo mejor es la comandera. El pedido llega, sale el ticket y ya sabemos que está para delivery. Cero errores humanos y más rapidez.', name: 'Julia R.', role: 'Hamburguesería El Mono', initials: 'JR' },
  { quote: 'Excelente soporte técnico. Me ayudaron a configurar el menú en una tarde y al día siguiente ya estábamos vendiendo por WhatsApp.', name: 'Roberto K.', role: 'Gerente de Café Central', initials: 'RK' },
];

export const PRICING = {
  name: 'Sotcksystem Full',
  price: '$50.000',
  period: '/ mes',
  features: [
    'Bot de WhatsApp Ilimitado',
    'Panel de Administración',
    'Comandera Digital + Impresión',
    'Gestión de Stock y Recetas',
    'Soporte Técnico 24/7',
  ],
};

export const FAQ = [
  { q: '¿Necesito tener una computadora siempre encendida?', a: 'No, el sistema funciona 100% en la nube. El bot atiende a tus clientes aunque tu negocio esté cerrado o no tengas internet en ese momento.' },
  { q: '¿Cómo recibo los avisos de nuevos pedidos?', a: 'Los recibís instantáneamente en tu Panel de Administración (PC, Tablet o Celular). Además, si tenés una impresora térmica, el ticket sale automáticamente.' },
  { q: '¿Es difícil configurar el catálogo de productos?', a: '¡Para nada! Podés cargar tus productos en minutos desde una planilla o manualmente. Si necesitás ayuda, nuestro soporte te acompaña en el proceso.' },
];

export const CONTACT = { whatsapp: '5492915093499' };

// Demo flow (ported verbatim from landing-page/index.html)
export const DEMO_FLOW = {
  start:   { text: '¡Hola! Bienvenido a Rotisería El Delirio 🍕. ¿Qué te gustaría pedir?', btns: ['Ver Menú 📋', 'Sugerencia del día 🌟'] },
  menu:    { text: 'Tenemos estas delicias hoy:\n1. Pizza Pepperoni - $5200\n2. Hamburguesa Especial - $4800\n3. Empanadas (x12) - $3600', btns: ['Pedir Pizza 🍕', 'Pedir Burguer 🍔'] },
  address: { text: '¡Excelente elección! Pasame tu dirección para el delivery.', btns: ['Calle Falsa 123 🏠', 'Retiro en local 🏪'] },
  final:   { text: '¡Listo! Tu pedido fue recibido por el local. En 30-40 min llega a tu puerta. ¡Gracias!', btns: ['Hacer otro pedido 🔄'] },
} as const;
