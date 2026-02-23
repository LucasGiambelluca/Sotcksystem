-- ============================================================
-- FINAL ROBUST DATABASE CLEANUP SCRIPT (100% EMPTY)
-- ============================================================
-- This script cleans EVERYTHING including bot flows.
-- The ONLY thing preserved is the 'users' table to maintain your login.

DO $$ 
DECLARE 
    tbl text;
    tables_to_clean text[] := ARRAY[
        -- Core Business
        'order_items', 'orders', 'movements', 'claims', 'tickets', 'order_status_history',
        -- Logistics
        'routes', 'route_orders', 'preparation_queues', 'delivery_slots', 'shipping_zones',
        -- WhatsApp & AI
        'whatsapp_messages', 'whatsapp_conversations', 'whatsapp_sessions', 
        'chat_sessions', 'user_memory', 'flow_executions',
        -- Bot Flows (Visual Builder)
        'bot_flows', 'flows',
        -- Entities
        'clients', 'products',
        -- Config
        'whatsapp_config', 'dashboard_config'
    ];
BEGIN 
    FOREACH tbl IN ARRAY tables_to_clean
    LOOP 
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            EXECUTE 'TRUNCATE TABLE ' || quote_ident(tbl) || ' CASCADE';
            RAISE NOTICE 'Limpiada tabla: %', tbl;
        END IF;
    END LOOP; 
END $$;
