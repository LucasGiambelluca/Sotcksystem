-- Add notification templates to whatsapp_config
-- Using safe ALTERS to avoid errors if columns already exist

DO $$
BEGIN
    -- CONFIRMED
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'template_confirmed') THEN
        ALTER TABLE whatsapp_config ADD COLUMN template_confirmed TEXT DEFAULT '✅ *Pedido Confirmado*

Hola {clientName}! Tu pedido ha sido confirmado.

📦 Pedido: #{orderId}
💰 Total: ${total}
{deliveryDate}

Te avisaremos cuando comencemos a prepararlo.';
    END IF;

    -- IN_PREPARATION
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'template_preparation') THEN
        ALTER TABLE whatsapp_config ADD COLUMN template_preparation TEXT DEFAULT '👨‍🍳 *Pedido en Preparación*

Hola {clientName}! Estamos preparando tu pedido.

📦 Pedido: #{orderId}
⏱️ Tiempo estimado: 30-45 min

Te avisaremos cuando salga para entrega.';
    END IF;

    -- IN_TRANSIT
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'template_transit') THEN
        ALTER TABLE whatsapp_config ADD COLUMN template_transit TEXT DEFAULT '🚚 *Pedido en Camino*

Hola {clientName}! Tu pedido está en camino.

📦 Pedido: #{orderId}
{deliveryAddress}

¡Pronto estaremos ahí!';
    END IF;

    -- DELIVERED
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'template_delivered') THEN
        ALTER TABLE whatsapp_config ADD COLUMN template_delivered TEXT DEFAULT '✅ *Pedido Entregado*

Hola {clientName}! Tu pedido ha sido entregado.

📦 Pedido: #{orderId}
💰 Total: ${total}

¡Gracias por tu compra! 🎉';
    END IF;

    -- CANCELLED
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'template_cancelled') THEN
        ALTER TABLE whatsapp_config ADD COLUMN template_cancelled TEXT DEFAULT '❌ *Pedido Cancelado*

Hola {clientName}, lamentamos informarte que tu pedido ha sido cancelado.

📦 Pedido: #{orderId}

Si tenés alguna consulta, no dudes en contactarnos.';
    END IF;

END $$;
