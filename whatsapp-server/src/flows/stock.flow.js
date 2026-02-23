const Parser = require('../core/parser');
const { productService } = require('../services/ProductService');
const MESSAGES = require('../config/messages');

module.exports = {
    step: 'stock',

    async enter(session) {
        // Entry is handled by router when it detects an inquiry,
        // so we don't need to send anything here.
        return [];
    },

    async handle(text, session) {
        const clean = text.toLowerCase().trim();

        // --- Handle YES/NO response (user was asked to add to cart) ---
        if (session.data._stockPending) {
            const pending = session.data._stockPending;

            if (['si', 'sí', 'yes', 'dale', 'ok', 'bueno', 'agregar', 'quiero'].includes(clean)) {
                // Add to cart
                const currentItems = session.data.items || [];
                currentItems.push({
                    qty: pending.qty,
                    name: pending.name,
                    price: pending.price,
                    product_id: pending.product_id
                });

                const newTotal = currentItems.reduce((sum, i) => sum + (i.price * i.qty), 0);

                // Clear pending, update cart
                const updatedData = {
                    ...session.data,
                    items: currentItems,
                    total: newTotal,
                    _stockPending: null
                };

                return {
                    data: updatedData,
                    nextStep: 'order',
                    messages: [
                        MESSAGES.ORDER.ADDED(pending.qty, pending.name, currentItems.length, newTotal)
                    ]
                };
            }

            if (['no', 'nah', 'nope', 'no gracias'].includes(clean)) {
                return {
                    data: { ...session.data, _stockPending: null },
                    nextStep: 'order',
                    messages: ['👍 Sin problema. ¿Querés pedir algo más?']
                };
            }

            // If they type something else, try to parse it as a new stock inquiry
            // (fall through to the logic below)
        }

        // --- Handle new stock inquiry while already in this flow ---
        const inquiry = Parser.detectStockInquiry(text);
        if (inquiry) {
            return await this.processInquiry(inquiry, session);
        }

        // --- If user types something that's not a stock question, return to order flow ---
        return {
            data: { ...session.data, _stockPending: null },
            nextStep: 'order',
            messages: [] // Let order flow handle it
        };
    },

    /**
     * Core logic: search product, check stock, reply.
     */
    async processInquiry(inquiry, session) {
        const { qty, product: searchTerm } = inquiry;

        // 1. Find product using fuzzy search
        const product = await productService.findProduct(searchTerm);

        if (!product) {
            return {
                messages: [
                    `❌ No encontré un producto que coincida con *"${searchTerm}"*.`
                    + `\nProbá con otro nombre o escribí *"menu"* para ver qué tenemos.`
                ]
            };
        }

        const currentStock = product.stock;

        // 2. Check availability
        if (currentStock <= 0) {
            return {
                messages: [
                    `😔 *${product.name}* está agotado en este momento.\n`
                    + `Escribí *"menu"* para ver productos disponibles.`
                ]
            };
        }

        // 3. If user asked for a specific qty
        if (qty !== null) {
            if (currentStock >= qty) {
                // Enough stock — offer to add
                return {
                    data: {
                        _stockPending: {
                            qty,
                            name: product.name,
                            price: product.price,
                            product_id: product.id
                        }
                    },
                    messages: [
                        `✅ ¡Sí! Tenemos *${product.name}* disponible.`
                        + `\n📦 Stock actual: ${currentStock} unidades`
                        + `\n💰 Precio: $${product.price} c/u`
                        + `\n\n¿Querés agregar *${qty}x ${product.name}* ($${product.price * qty}) a tu pedido?`
                        + `\nRespondé *Sí* o *No*.`
                    ]
                };
            } else {
                // Not enough stock — offer partial
                return {
                    data: {
                        _stockPending: {
                            qty: currentStock,
                            name: product.name,
                            price: product.price,
                            product_id: product.id
                        }
                    },
                    messages: [
                        `⚠️ No tenemos ${qty}, pero nos quedan *${currentStock}* unidades de *${product.name}*.`
                        + `\n💰 Precio: $${product.price} c/u`
                        + `\n\n¿Querés agregar *${currentStock}x ${product.name}* ($${product.price * currentStock}) a tu pedido?`
                        + `\nRespondé *Sí* o *No*.`
                    ]
                };
            }
        }

        // 4. No qty specified, just checking availability
        return {
            data: {
                _stockPending: {
                    qty: 1,
                    name: product.name,
                    price: product.price,
                    product_id: product.id
                }
            },
            messages: [
                `✅ ¡Sí, tenemos *${product.name}*!`
                + `\n📦 Stock: ${currentStock} unidades disponibles`
                + `\n💰 Precio: $${product.price} c/u`
                + `\n\n¿Cuántas querés agregar? O respondé *Sí* para agregar 1.`
            ]
        };
    }
};
