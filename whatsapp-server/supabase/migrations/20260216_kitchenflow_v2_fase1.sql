-- KitchenFlow Pro - Fase 1: Optimización y Consolidación

-- 1. Índices de Rendimiento
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- Necesario para índices GIN trgm

CREATE INDEX IF NOT EXISTS idx_products_active_category 
ON products(is_active, category) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm 
ON products USING gin (name gin_trgm_ops);

-- 2. Locking Optimista en Slots
ALTER TABLE delivery_slots 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

-- 3. Nueva Tabla de Sesiones (Chat Sessions)
-- Reemplazará a flow_executions para un manejo más robusto
CREATE TABLE IF NOT EXISTS chat_sessions (
    phone VARCHAR(50) PRIMARY KEY,
    
    current_flow_id UUID REFERENCES flows(id),
    current_node_id VARCHAR(100) NOT NULL,
    
    context JSONB NOT NULL DEFAULT '{}',
    context_version INTEGER DEFAULT 1,
    
    navigation_history JSONB DEFAULT '[]',
    
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 minutes'),
    
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, WAITING_INPUT, ERROR
    waiting_for_input BOOLEAN DEFAULT false,
    
    last_error TEXT,
    retry_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_expires ON chat_sessions(expires_at) 
WHERE status = 'ACTIVE';

-- Función de limpieza (opcional si se usa pg_cron, pero útil tenerla)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    UPDATE chat_sessions SET status = 'EXPIRED' 
    WHERE expires_at < NOW() AND status = 'ACTIVE';
END;
$$ LANGUAGE plpgsql;
