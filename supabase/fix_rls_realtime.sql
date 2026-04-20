-- MIGRACIÓN DE URGENCIA: Arreglar Realtime y RLS para el Panel de WhatsApp
BEGIN;

-- 1. Asegurar que las tablas están en la publicación de Realtime
-- Esto permite que Supabase envíe eventos INSERT/UPDATE al frontend
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversations;
    END IF;
END $$;

-- 2. Habilitar RLS (Row Level Security)
-- Si ya está activo, no hace nada dañino
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- 3. Crear Políticas para que los usuarios autenticados (el panel) puedan ver los mensajes
-- Sin estas políticas, el frontend recibe eventos vacíos o no recibe nada si RLS está activo
DROP POLICY IF EXISTS "whatsapp_messages_admin_all" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_admin_all" ON whatsapp_messages
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "whatsapp_conversations_admin_all" ON whatsapp_conversations;
CREATE POLICY "whatsapp_conversations_admin_all" ON whatsapp_conversations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Asegurar que Clients también es accesible por el panel
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_admin_all" ON clients;
CREATE POLICY "clients_admin_all" ON clients
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
