-- Migration: Create Unified Stock Flow
-- Description: Replaces the legacy stock.flow.js with a DB-driven flow using StockCheckNode and AddToCartNode.

INSERT INTO flows (name, trigger_word, is_active, nodes, edges)
VALUES (
    'Consulta de Stock',
    'stock',
    true,
    '[
        {
            "id": "start_stock",
            "type": "stockCheckNode",
            "position": { "x": 100, "y": 100 },
            "data": {
                "variable": "stock_result",
                "question": "🔍 *Consulta de Stock*\n\nEscribí el nombre del producto que buscás (ej: \"hamburguesa\")."
            }
        },
        {
            "id": "ask_add",
            "type": "pollNode",
            "position": { "x": 100, "y": 300 },
            "data": {
                "question": "¿Querés agregar este producto al pedido?",
                "options": ["Sí, agregar", "No, seguir buscando", "Ver mi carrito"],
                "variable": "confirmacion_stock"
            }
        },
        {
            "id": "check_choice",
            "type": "conditionNode",
            "position": { "x": 100, "y": 500 },
            "data": {
                "conditions": [
                    { "variable": "confirmacion_stock", "operator": "equals", "value": "Sí, agregar", "target_handle": "yes" },
                    { "variable": "confirmacion_stock", "operator": "equals", "value": "No, seguir buscando", "target_handle": "no" },
                    { "variable": "confirmacion_stock", "operator": "equals", "value": "Ver mi carrito", "target_handle": "cart" }
                ]
            }
        },
        {
            "id": "add_item",
            "type": "addToCartNode",
            "position": { "x": -100, "y": 700 },
            "data": {
                "productVariable": "stock_result"
            }
        },
        {
            "id": "goto_catalog",
            "type": "flowLinkNode",
            "position": { "x": 300, "y": 700 },
            "data": {
                "flowId": "checkout_catalogo"
            }
        }
    ]'::jsonb,
    '[
        { "id": "e1", "source": "start_stock", "target": "ask_add" },
        { "id": "e2", "source": "ask_add", "target": "check_choice" },
        { "id": "e3", "source": "check_choice", "sourceHandle": "yes", "target": "add_item" },
        { "id": "e4", "source": "check_choice", "sourceHandle": "no", "target": "start_stock" },
        { "id": "e5", "source": "check_choice", "sourceHandle": "cart", "target": "goto_catalog" },
        { "id": "e6", "source": "add_item", "target": "start_stock" }
    ]'::jsonb
);
