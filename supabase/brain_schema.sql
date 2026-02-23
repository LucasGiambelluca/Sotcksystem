-- Sesión activa: el "cerebro" en tiempo real
CREATE TABLE IF NOT EXISTS conversation_brain (
    phone TEXT PRIMARY KEY,
    tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000', -- Default for now
    
    -- Estado actual
    current_flow_id UUID,
    current_node_id TEXT,
    status TEXT CHECK (status IN ('idle', 'active', 'waiting_input', 'error', 'paused')),
    
    -- Memoria de trabajo (contexto inmediato)
    working_memory JSONB DEFAULT '{
        "turn_count": 0,
        "last_intent": null,
        "expected_input": null,
        "current_topic": null,
        "consecutive_errors": 0
    }',
    
    -- Stack de navegación (para volver atrás)
    navigation_stack JSONB DEFAULT '[]', -- [{flow_id, node_id, timestamp}]
    
    -- Variables de sesión (datos recolectados)
    session_vars JSONB DEFAULT '{}',
    
    -- Historial corto (últimos 10 mensajes para contexto)
    recent_history JSONB DEFAULT '[]',
    
    -- Metadatos
    started_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 hours'),
    
    -- Control de concurrencia
    version INTEGER DEFAULT 1
);

-- Memoria persistente del usuario (entre conversaciones)
CREATE TABLE IF NOT EXISTS user_memory (
    phone TEXT PRIMARY KEY,
    tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
    
    -- Perfil acumulado
    profile JSONB DEFAULT '{
        "name": null,
        "preferences": {},
        "common_intents": [],
        "friction_points": []
    }',
    
    -- Historial de interacciones resumido
    interaction_patterns JSONB DEFAULT '{
        "peak_hours": [],
        "common_flows": [],
        "abandonment_points": []
    }',
    
    -- Última sesión para continuidad
    last_session_summary TEXT,
    last_session_date TIMESTAMP,
    
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices críticos
CREATE INDEX IF NOT EXISTS idx_brain_tenant ON conversation_brain(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_brain_activity ON conversation_brain(last_activity);
CREATE INDEX IF NOT EXISTS idx_user_memory_tenant ON user_memory(tenant_id);
