const MESSAGES = require('../config/messages');
const Parser = require('../core/parser');
const { productService } = require('../services/ProductService');

module.exports = {
    step: 'order',
    
    // Enter: Only if router triggers it.
    async enter(session) {
        return []; 
    },

    async handle(text, session) {
        const clean = text.toLowerCase().trim();

        // 1. Commands inside Order
        if (clean === 'menu') {
            return { nextStep: 'welcome' };
        }
        
        if (['ver carrito', 'carrito', 'mi pedido'].includes(clean)) {
             const items = session.data.items || [];
             if (items.length === 0) return { messages: [MESSAGES.ORDER.CART_EMPTY] };
             
             // Calculate local total if not present
             const total = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
             const itemsTxt = items.map(i => `• ${i.qty}x ${i.name} ($${i.price * i.qty})`).join('\n');
             
             return { messages: [MESSAGES.ORDER.CART_STATUS(itemsTxt, total)] };
        }

        if (['confirmar', 'listo', 'ya esta', 'fin', 'terminar'].includes(clean)) {
            const items = session.data.items || [];
            if (items.length === 0) {
                return { messages: ["⚠️ Tu carrito está vacío. Pedí algo primero."] };
            }
            return { nextStep: 'confirm' };
        }

        // 2. Parse Items
        const items = Parser.parse(text);
        
        if (items.length > 0) {
            const verifiedItems = [];
             let totalAdded = 0;
             const notFound = [];

            for (const item of items) {
                const product = await productService.findProduct(item.product);
                if (product) {
                    // Normalize item structure
                    verifiedItems.push({
                        qty: item.qty,
                        name: product.name,
                        price: product.price,
                        product_id: product.id
                    });
                    totalAdded += product.price * item.qty;
                } else {
                    notFound.push(item.product);
                }
            }

            // Reporting Not Found
            if (verifiedItems.length === 0) {
                const msg = notFound.length > 0 
                  ? `⚠️ No encontré: "${notFound.join(', ')}".\nProbá escribiendo tal cual está en el menú.`
                  : "⚠️ No entendí qué producto quieres.";
                return { messages: [msg] };
            }

            // Update Session
            const currentItems = session.data.items || [];
            const newCart = [...currentItems, ...verifiedItems];
            const newTotal = (session.data.total || 0) + totalAdded;
            
            // Build Success Message
            const lastItem = verifiedItems[verifiedItems.length-1];
            let response = MESSAGES.ORDER.ADDED(lastItem.qty, lastItem.name, newCart.length, newTotal);
            
            if (notFound.length > 0) {
                response += `\n(⚠️ Ignorado no encontrado: ${notFound.join(', ')})`;
            }

            return {
                data: {
                    items: newCart,
                    total: newTotal
                },
                messages: [response]
            };
        }

        // 3. Fallback
        return { messages: [MESSAGES.ORDER.NOT_UNDERSTOOD] };
    }
};
