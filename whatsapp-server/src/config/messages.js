module.exports = {
    WELCOME: {
        MENU: (name = 'Cliente') => `¡Hola ${name}! 👋 Bienvenido a Hamburguesas El Topo 🍔\n\n📋 *MENÚ DEL DÍA:*\n\n🍔 *Hamburguesa Clásica* - $500\n🍔 *Hamburguesa Doble* - $700\n🍕 *Pizza Muzzarella* - $800\n🍕 *Pizza Especial* - $1000\n🍟 *Papas Fritas* - $300\n🥤 *Coca Cola / Sprite* - $200\n\n📝 *Cómo pedir:*\nEscribe tu pedido, por ejemplo:\n_"2 hamburguesas clasicas y 1 coca"_\n\nO escribe:\n• *"Ver carrito"* para revisar\n• *"Cancelar"* para reiniciar`,
    },
    ORDER: {
        ADDED: (qty, product, cartSize, total) => `✅ Agregado: ${qty}x ${product}\n🛒 Carrito: ${cartSize} items - Total: $${total}\n\n¿Algo más? Escribe otro producto o *"Confirmar"* para terminar.`,
        NOT_UNDERSTOOD: "❌ No entendí qué producto quieres.\nProbá escribiendo el nombre tal cual figura en el menú (ej: 'hamburguesa', 'pizza', 'coca').",
        CART_EMPTY: "🛒 Tu carrito está vacío. ¡Pedí algo rico del menú!",
        CART_STATUS: (itemsTxt, total) => `🛒 *TU CARRITO:*\n${itemsTxt}\n\n💰 *Total:* $${total}\n\nEscribe *"Confirmar"* para finalizar o sigue agregando productos.`,
    },
    CONFIRM: {
        SUMMARY: (itemsTxt, total) => `📝 *RESUMEN DEL PEDIDO:*\n\n${itemsTxt}\n\n💰 *TOTAL A PAGAR: $${total}*\n\n¿Confirmamos? (Escribe *"Si"* o *"Cancelar"*)`,
        CANCELLED: "❌ Pedido cancelado. Escribe 'Hola' para empezar de nuevo.",
    },
    SCHEDULE: {
        ASK_DATE: "⏰ *¿Para cuándo lo querés?*\n\nIndica fecha y hora. Ejemplos:\n• _Ahora_\n• _Hoy 21hs_\n• _Mañana al mediodía_\n• _Viernes 14:00_",
        INVALID_DATE: "⚠️ No entendí la fecha. Por favor probá con otro formato (ej: 'Hoy 20:00').",
    },
    CLOSE: {
        SUCCESS: (orderId, total, date) => `✅ *¡PEDIDO CONFIRMADO!* 🎉\n\n📦 Pedido: #${orderId}\n💰 Total: $${total}\n📅 Entrega: ${date}\n\nTe avisaremos cuando esté en camino. ¡Gracias!`,
        ERROR: "⚠️ Hubo un error al guardar tu pedido. Por favor contactanos por teléfono.",
    },
    ADDRESS: {
        ASK: "📍 *¿Dónde te lo llevamos?*\n\nPor favor, enviá tu dirección completa (calle, número y si podés, alguna referencia).",
    },
    PAYMENT: {
        ASK: "💳 *¿Cómo vas a pagar?*\n\nElegí una opción:\n1️⃣ Efectivo\n2️⃣ MercadoPago (Link de pago)\n3️⃣ Tarjeta al recibir",
        INVALID: "❌ Opción de pago inválida. Respondé con 1, 2 o 3.",
    },
    FINAL_CONFIRM: {
        SUMMARY: (itemsTxt, total, slot, addr, pay) => `📋 *RESUMEN FINAL:*\n\n🛒 *Items:*\n${itemsTxt}\n\n⏰ *Entrega:* ${slot}\n📍 *Dirección:* ${addr}\n💳 *Pago:* ${pay}\n\n💰 *TOTAL: $${total}*\n\n¿Todo correcto? Respondé *SÍ* para confirmar o *NO* para modificar.`,
    },
    GLOBAL: {
        CANCEL: "🔄 Reiniciando...",
    }
};
