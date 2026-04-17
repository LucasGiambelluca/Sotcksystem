Plan de Integración Meta Business WhatsApp API
Arquitectura OAuth 2.0 + Webhooks + Multi-tenant
1. ARQUITECTURA DEL SISTEMA
1.1 Diagrama de Flujo Completo
plain
Copy
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTE (Frontend)                          │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  React/Vue App  │  │ Meta JS SDK      │  │ Gestión OAuth    │   │
│  │  - Botón Conn   │──│ - Login Dialog   │──│ - Callback Handler│  │
│  └─────────────────┘  └──────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY (Nginx/Kong)                    │
│     SSL Termination │ Rate Limiting │ Auth JWT Validation            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND SERVICE (Node.js/Python)                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ Auth Ctrl    │ │ Meta Ctrl    │ │ Webhook Ctrl │ │ Config Ctrl│ │
│  │ /oauth/*     │ │ /business/*  │ │ /webhooks/*  │ │ /settings/*│ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌──────────┐    ┌──────────┐    ┌──────────┐
            │PostgreSQL│    │  Redis   │    │  Queue   │
            │(Estado)  │    │(Sesiones)│    │ (Jobs)   │
            └──────────┘    └──────────┘    └──────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      META GRAPH API v18.0                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ OAuth        │  │ WABA Mgmt    │  │ Messages     │              │
│  │ /oauth/*     │  │ /whatsapp_business_accounts/* │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
2. MODELO DE DATOS (PostgreSQL)
2.1 Schema Completo
sql
Copy
-- Extensión para encriptación
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabla: Tenants (multi-tenant)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
    plan_type VARCHAR(20) DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Users (simplificada, solo referencia)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'operator')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Meta Connections (Core)
CREATE TABLE meta_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Identificadores Meta
    meta_app_id VARCHAR(50) NOT NULL,
    meta_business_id VARCHAR(50),
    meta_waba_id VARCHAR(50), -- WhatsApp Business Account ID
    meta_phone_number_id VARCHAR(50),
    meta_phone_number VARCHAR(20), -- Formato E.164 +525512345678
    
    -- Tokens (Encriptados)
    access_token_encrypted BYTEA NOT NULL,
    refresh_token_encrypted BYTEA,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Estado de la conexión
    status VARCHAR(30) DEFAULT 'pending' CHECK (
        status IN ('pending', 'active', 'refreshing', 'error', 'disconnected', 'revoked')
    ),
    connection_error TEXT, -- Último error si status='error'
    
    -- Configuración Webhook
    webhook_verify_token VARCHAR(100),
    webhook_url VARCHAR(500),
    webhook_subscribed BOOLEAN DEFAULT false,
    
    -- Configuración del número
    display_name VARCHAR(100),
    quality_rating VARCHAR(20), -- GREEN, YELLOW, RED, etc.
    messaging_limit_tier VARCHAR(20),
    
    -- Tiempos
    connected_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    last_refresh_at TIMESTAMP WITH TIME ZONE,
    disconnected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(tenant_id, meta_phone_number_id),
    CONSTRAINT valid_phone_format CHECK (meta_phone_number ~ '^\+[1-9]\d{1,14}$')
);

-- Tabla: OAuth States (Seguridad CSRF)
CREATE TABLE oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 del state
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    redirect_uri VARCHAR(500) NOT NULL,
    scopes TEXT[] NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Connection Logs (Auditoría)
CREATE TABLE meta_connection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES meta_connections(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'auth_initiated', 'token_exchanged', 'webhook_received', 'error', 'refreshed'
    event_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices optimizados
CREATE INDEX idx_meta_connections_tenant ON meta_connections(tenant_id);
CREATE INDEX idx_meta_connections_status ON meta_connections(status) WHERE status = 'active';
CREATE INDEX idx_meta_connections_phone ON meta_connections(meta_phone_number);
CREATE INDEX idx_oauth_states_hash ON oauth_states(state_hash);
CREATE INDEX idx_connection_logs_conn ON meta_connection_logs(connection_id, created_at DESC);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_meta_connections_updated_at BEFORE UPDATE
    ON meta_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
2.2 Servicio de Encriptación (Node.js)
JavaScript
Copy
// services/encryption.service.js
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes

class EncryptionService {
    encrypt(text) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        // Formato: iv:authTag:encrypted
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }
    
    decrypt(encryptedData) {
        const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
        
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }
}

module.exports = new EncryptionService();
3. FLUJO OAUTH DETALLADO
3.1 Secuencia Completa
plain
Copy
Usuario          Frontend          Backend          Meta API          Database
   │                │                │                │                │
   │  Click "Conectar WhatsApp"     │                │                │
   │───────────────────────────────>│                │                │
   │                │  POST /oauth/meta/init         │                │
   │                │───────────────────────────────>│                │
   │                │                │  Generar state │                │
   │                │                │  Guardar en DB │                │
   │                │                │<───────────────│                │
   │                │  Return {authUrl, state}       │                │
   │                │<───────────────────────────────│                │
   │  window.open(authUrl)          │                │                │
   │<───────────────────────────────│                │                │
   │                │                │                │                │
   │  Login + Select Business       │                │                │
   │─────────────────────────────────────────────────>│                │
   │                │                │                │                │
   │                │                │  Redirect a redirect_uri        │
   │                │                │  ?code=XXX&state=YYY            │
   │                │                │<───────────────│                │
   │                │                │                │                │
   │                │  GET /oauth/meta/callback      │                │
   │                │  ?code=XXX&state=YYY           │                │
   │                │───────────────────────────────>│                │
   │                │                │  Validar state │                │
   │                │                │  Exchange code │                │
   │                │                │  por token     │                │
   │                │                │<───────────────│                │
   │                │                │                │                │
   │                │                │  GET /me/businesses             │
   │                │                │  GET /whatsapp_business_accounts│
   │                │                │<───────────────│                │
   │                │                │                │                │
   │                │                │  Guardar tokens │               │
   │                │                │  encriptados    │               │
   │                │                │<───────────────│                │
   │                │                │                │                │
   │                │  WebSocket/SSE: connection_ready│                │
   │                │<───────────────────────────────│                │
   │  Mostrar "Conectado: +52..."   │                │                │
   │<───────────────────────────────│                │                │
3.2 Implementación Backend (Node.js/Express)
JavaScript
Copy
// controllers/oauth.controller.js
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const axios = require('axios');
const db = require('../db');
const encryption = require('../services/encryption.service');

const META_OAUTH_URL = 'https://www.facebook.com/v18.0/dialog/oauth';
const META_TOKEN_URL = 'https://graph.facebook.com/v18.0/oauth/access_token';
const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';

class OAuthController {
    
    // Paso 1: Iniciar flujo OAuth
    async initiateConnection(req, res) {
        const { tenant_id, user_id } = req.user; // Del JWT
        const { redirect_uri } = req.body; // URL frontend para callback
        
        // Generar state único (CSRF protection)
        const state = crypto.randomBytes(32).toString('hex');
        const stateHash = crypto.createHash('sha256').update(state).digest('hex');
        
        // Guardar state en DB (expira en 10 minutos)
        await db.query(
            `INSERT INTO oauth_states (state_hash, tenant_id, user_id, redirect_uri, scopes, expires_at)
             VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '10 minutes')`,
            [stateHash, tenant_id, user_id, redirect_uri, 
             ['business_management', 'whatsapp_business_management', 'whatsapp_business_messaging']]
        );
        
        // Construir URL de autorización
        const authUrl = new URL(META_OAUTH_URL);
        authUrl.searchParams.append('client_id', process.env.META_APP_ID);
        authUrl.searchParams.append('redirect_uri', `${process.env.BACKEND_URL}/oauth/meta/callback`);
        authUrl.searchParams.append('state', state);
        authUrl.searchParams.append('scope', 'business_management,whatsapp_business_management,whatsapp_business_messaging');
        authUrl.searchParams.append('response_type', 'code');
        
        // Opcional: Pre-seleccionar configuración de WhatsApp
        authUrl.searchParams.append('extras', JSON.stringify({
            setup: { feature: 'whatsapp_business_management' },
            business_config: { business: { name: req.user.tenant_name } }
        }));
        
        res.json({
            success: true,
            data: {
                auth_url: authUrl.toString(),
                state: state // Frontend debe guardar esto para validar
            }
        });
    }
    
    // Paso 2: Callback de Meta
    async handleCallback(req, res) {
        const { code, state, error, error_reason } = req.query;
        
        if (error) {
            console.error('OAuth Error:', error, error_reason);
            return res.redirect(`${process.env.FRONTEND_URL}/settings/whatsapp?error=${error}`);
        }
        
        // Validar state
        const stateHash = crypto.createHash('sha256').update(state).digest('hex');
        const stateRecord = await db.query(
            `SELECT * FROM oauth_states 
             WHERE state_hash = $1 AND used = false AND expires_at > NOW()`,
            [stateHash]
        );
        
        if (stateRecord.rows.length === 0) {
            return res.redirect(`${process.env.FRONTEND_URL}/settings/whatsapp?error=invalid_state`);
        }
        
        const { tenant_id, user_id } = stateRecord.rows[0];
        
        try {
            // Marcar state como usado
            await db.query('UPDATE oauth_states SET used = true WHERE state_hash = $1', [stateHash]);
            
            // Intercambiar code por access token
            const tokenResponse = await axios.get(META_TOKEN_URL, {
                params: {
                    client_id: process.env.META_APP_ID,
                    client_secret: process.env.META_APP_SECRET,
                    redirect_uri: `${process.env.BACKEND_URL}/oauth/meta/callback`,
                    code: code
                }
            });
            
            const shortLivedToken = tokenResponse.data.access_token;
            
            // Obtener token de larga duración (60 días)
            const longLivedToken = await this.exchangeLongLivedToken(shortLivedToken);
            
            // Obtener datos del Business y WABA
            const businessData = await this.fetchBusinessData(longLivedToken);
            
            // Crear o actualizar conexión
            const connection = await this.saveConnection({
                tenant_id,
                user_id,
                access_token: longLivedToken,
                business_data: businessData
            });
            
            // Configurar webhook automáticamente
            await this.configureWebhook(connection.id, longLivedToken, businessData.waba_id);
            
            // Notificar a frontend vía WebSocket (opcional)
            this.notifyFrontend(tenant_id, {
                type: 'whatsapp_connected',
                data: {
                    phone_number: businessData.phone_number,
                    display_name: businessData.display_name
                }
            });
            
            // Redirect al frontend con éxito
            res.redirect(`${process.env.FRONTEND_URL}/settings/whatsapp?success=true&connection_id=${connection.id}`);
            
        } catch (err) {
            console.error('OAuth Callback Error:', err);
            
            // Log del error
            await db.query(
                `INSERT INTO meta_connection_logs (connection_id, event_type, event_data, created_at)
                 VALUES ($1, 'error', $2, NOW())`,
                [null, JSON.stringify({ error: err.message, step: 'callback' })]
            );
            
            res.redirect(`${process.env.FRONTEND_URL}/settings/whatsapp?error=connection_failed`);
        }
    }
    
    // Intercambiar por token larga duración
    async exchangeLongLivedToken(shortToken) {
        const response = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: process.env.META_APP_ID,
                client_secret: process.env.META_APP_SECRET,
                fb_exchange_token: shortToken
            }
        });
        
        return response.data.access_token;
    }
    
    // Obtener datos del Business
    async fetchBusinessData(accessToken) {
        // 1. Obtener Business Accounts
        const meResponse = await axios.get(`${GRAPH_API_BASE}/me/businesses`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        const businessId = meResponse.data.data[0]?.id;
        if (!businessId) throw new Error('No business accounts found');
        
        // 2. Obtener WhatsApp Business Accounts
        const wabaResponse = await axios.get(`${GRAPH_API_BASE}/${businessId}/whatsapp_business_accounts`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        const wabaId = wabaResponse.data.data[0]?.id;
        if (!wabaId) throw new Error('No WhatsApp Business accounts found');
        
        // 3. Obtener números de teléfono
        const phonesResponse = await axios.get(`${GRAPH_API_BASE}/${wabaId}/phone_numbers`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        const phoneData = phonesResponse.data.data[0];
        if (!phoneData) throw new Error('No phone numbers found');
        
        // 4. Obtener detalles específicos del número
        const phoneDetails = await axios.get(`${GRAPH_API_BASE}/${phoneData.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { fields: 'display_name,quality_rating,verified_name,account_mode' }
        });
        
        return {
            business_id: businessId,
            waba_id: wabaId,
            phone_number_id: phoneData.id,
            phone_number: phoneData.display_phone_number,
            display_name: phoneDetails.data.display_name || phoneDetails.data.verified_name,
            quality_rating: phoneDetails.data.quality_rating,
            account_mode: phoneDetails.data.account_mode
        };
    }
    
    // Guardar en base de datos
    async saveConnection({ tenant_id, user_id, access_token, business_data }) {
        const encryptedToken = encryption.encrypt(access_token);
        
        // Calcular expiración (60 días menos 1 hora de margen)
        const expiresAt = new Date(Date.now() + (59 * 24 * 60 * 60 * 1000));
        
        const result = await db.query(
            `INSERT INTO meta_connections (
                tenant_id, user_id, meta_app_id, meta_business_id, meta_waba_id,
                meta_phone_number_id, meta_phone_number, access_token_encrypted,
                token_expires_at, status, display_name, quality_rating, connected_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11, NOW())
            ON CONFLICT (tenant_id, meta_phone_number_id) 
            DO UPDATE SET
                access_token_encrypted = EXCLUDED.access_token_encrypted,
                token_expires_at = EXCLUDED.token_expires_at,
                status = 'active',
                updated_at = NOW()
            RETURNING *`,
            [
                tenant_id, 
                user_id,
                process.env.META_APP_ID,
                business_data.business_id,
                business_data.waba_id,
                business_data.phone_number_id,
                business_data.phone_number,
                encryptedToken,
                expiresAt,
                business_data.display_name,
                business_data.quality_rating
            ]
        );
        
        // Log del evento
        await db.query(
            `INSERT INTO meta_connection_logs (connection_id, event_type, event_data, created_at)
             VALUES ($1, 'connected', $2, NOW())`,
            [result.rows[0].id, JSON.stringify(business_data)]
        );
        
        return result.rows[0];
    }
    
    // Configurar webhook automáticamente
    async configureWebhook(connectionId, accessToken, wabaId) {
        const verifyToken = crypto.randomBytes(32).toString('hex');
        const webhookUrl = `${process.env.BACKEND_URL}/webhooks/meta/${connectionId}`;
        
        try {
            // Suscribir app al WABA
            await axios.post(`${GRAPH_API_BASE}/${wabaId}/subscribed_apps`, {
                override_callback_uri: webhookUrl,
                verify_token: verifyToken
            }, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            // Actualizar conexión con datos de webhook
            await db.query(
                `UPDATE meta_connections 
                 SET webhook_verify_token = $1, webhook_url = $2, webhook_subscribed = true 
                 WHERE id = $3`,
                [verifyToken, webhookUrl, connectionId]
            );
            
        } catch (err) {
            console.error('Webhook configuration failed:', err.message);
            // No fallar la conexión si el webhook falla, se puede reintentar después
        }
    }
}

module.exports = new OAuthController();
4. API ENDPOINTS ESPECÍFICOS
4.1 Estructura de Rutas
JavaScript
Copy
// routes/whatsapp.routes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const oauthController = require('../controllers/oauth.controller');
const connectionController = require('../controllers/connection.controller');
const webhookController = require('../controllers/webhook.controller');

// OAuth Flow
router.post('/oauth/meta/init', authMiddleware, oauthController.initiateConnection);
router.get('/oauth/meta/callback', oauthController.handleCallback);

// Connection Management
router.get('/connections', authMiddleware, connectionController.listConnections);
router.get('/connections/:id', authMiddleware, connectionController.getConnection);
router.delete('/connections/:id', authMiddleware, connectionController.disconnect);
router.post('/connections/:id/refresh', authMiddleware, connectionController.refreshToken);
router.post('/connections/:id/test', authMiddleware, connectionController.testConnection);

// Webhooks (públicos, con verificación de firma)
router.get('/webhooks/meta/:connectionId', webhookController.verify);
router.post('/webhooks/meta/:connectionId', webhookController.handleIncoming);

// Dashboard Stats
router.get('/stats/:connectionId', authMiddleware, connectionController.getStats);

module.exports = router;
4.2 Controller de Gestión (connection.controller.js)
JavaScript
Copy
class ConnectionController {
    
    // Listar conexiones activas del tenant
    async listConnections(req, res) {
        const { tenant_id } = req.user;
        
        const result = await db.query(
            `SELECT id, meta_phone_number, display_name, status, 
                    quality_rating, connected_at, last_used_at, created_at
             FROM meta_connections 
             WHERE tenant_id = $1 
             ORDER BY created_at DESC`,
            [tenant_id]
        );
        
        res.json({
            success: true,
            data: result.rows
        });
    }
    
    // Obtener detalle de conexión (sin token)
    async getConnection(req, res) {
        const { tenant_id } = req.user;
        const { id } = req.params;
        
        const result = await db.query(
            `SELECT mc.*, 
                    (SELECT COUNT(*) FROM meta_connection_logs 
                     WHERE connection_id = mc.id AND event_type = 'message_received') as total_messages,
                    (SELECT COUNT(*) FROM meta_connection_logs 
                     WHERE connection_id = mc.id AND event_type = 'error') as error_count
             FROM meta_connections mc
             WHERE mc.id = $1 AND mc.tenant_id = $2`,
            [id, tenant_id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Connection not found' });
        }
        
        // No devolver tokens encriptados en la respuesta
        const { access_token_encrypted, refresh_token_encrypted, webhook_verify_token, ...data } = result.rows[0];
        
        res.json({ success: true, data });
    }
    
    // Desconectar (revocar)
    async disconnect(req, res) {
        const { tenant_id } = req.user;
        const { id } = req.params;
        
        // Verificar que pertenece al tenant
        const conn = await db.query(
            'SELECT * FROM meta_connections WHERE id = $1 AND tenant_id = $2',
            [id, tenant_id]
        );
        
        if (conn.rows.length === 0) {
            return res.status(404).json({ error: 'Not found' });
        }
        
        // Opcional: Llamar a Meta para desuscribir webhooks
        try {
            const token = encryption.decrypt(conn.rows[0].access_token_encrypted);
            await axios.delete(
                `${GRAPH_API_BASE}/${conn.rows[0].meta_waba_id}/subscribed_apps`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (err) {
            console.log('Error unsubscribing webhook (continuing):', err.message);
        }
        
        // Soft delete - mantener registro pero marcar como desconectado
        await db.query(
            `UPDATE meta_connections 
             SET status = 'disconnected', 
                 disconnected_at = NOW(),
                 access_token_encrypted = NULL, -- Eliminar token por seguridad
                 updated_at = NOW()
             WHERE id = $1`,
            [id]
        );
        
        // Log
        await db.query(
            `INSERT INTO meta_connection_logs (connection_id, event_type, created_at)
             VALUES ($1, 'disconnected', NOW())`,
            [id]
        );
        
        res.json({ success: true, message: 'Disconnected successfully' });
    }
    
    // Refrescar token manualmente
    async refreshToken(req, res) {
        const { tenant_id } = req.user;
        const { id } = req.params;
        
        const conn = await db.query(
            'SELECT * FROM meta_connections WHERE id = $1 AND tenant_id = $2',
            [id, tenant_id]
        );
        
        if (conn.rows.length === 0) {
            return res.status(404).json({ error: 'Not found' });
        }
        
        try {
            const oldToken = encryption.decrypt(conn.rows[0].access_token_encrypted);
            
            // Meta no usa refresh tokens tradicionales, hay que hacer exchange
            // o simplemente verificar que sigue válido y renovar si es necesario
            const response = await axios.get(`${GRAPH_API_BASE}/me`, {
                headers: { Authorization: `Bearer ${oldToken}` }
            });
            
            // Si llegamos aquí, el token sigue válido
            // Para extenderlo, necesitaríamos un nuevo flujo OAuth o usar el token actual
            // para obtener uno nuevo de larga duración (si está por expirar)
            
            await db.query(
                `UPDATE meta_connections 
                 SET last_refresh_at = NOW(), updated_at = NOW()
                 WHERE id = $1`,
                [id]
            );
            
            res.json({ success: true, message: 'Token is valid' });
            
        } catch (err) {
            // Token inválido, marcar error
            await db.query(
                `UPDATE meta_connections SET status = 'error', connection_error = $1 WHERE id = $2`,
                [err.message, id]
            );
            
            res.status(401).json({ success: false, error: 'Token invalid, reconnection required' });
        }
    }
    
    // Enviar mensaje de prueba
    async testConnection(req, res) {
        const { tenant_id } = req.user;
        const { id } = req.params;
        const { to, message } = req.body; // to: número destino
        
        const conn = await db.query(
            'SELECT * FROM meta_connections WHERE id = $1 AND tenant_id = $2 AND status = $3',
            [id, tenant_id, 'active']
        );
        
        if (conn.rows.length === 0) {
            return res.status(404).json({ error: 'Connection not found or inactive' });
        }
        
        try {
            const token = encryption.decrypt(conn.rows[0].access_token_encrypted);
            const phoneNumberId = conn.rows[0].meta_phone_number_id;
            
            await axios.post(
                `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'text',
                    text: { body: message || 'Test message from your platform' }
                },
                {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            res.json({ success: true, message: 'Test message sent' });
            
        } catch (err) {
            res.status(500).json({ 
                success: false, 
                error: err.response?.data?.error?.message || err.message 
            });
        }
    }
}

module.exports = new ConnectionController();
5. WEBHOOKS - RECEPCIÓN DE MENSAJES
5.1 Controller de Webhooks
JavaScript
Copy
const crypto = require('crypto');
const db = require('../db');

class WebhookController {
    
    // Verificación inicial (Meta verifica el endpoint)
    async verify(req, res) {
        const { connectionId } = req.params;
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        if (mode === 'subscribe') {
            // Buscar el token de verificación para esta conexión
            const result = await db.query(
                'SELECT webhook_verify_token FROM meta_connections WHERE id = $1',
                [connectionId]
            );
            
            if (result.rows.length === 0) {
                return res.sendStatus(403);
            }
            
            const expectedToken = result.rows[0].webhook_verify_token;
            
            if (token === expectedToken) {
                console.log('Webhook verified for connection:', connectionId);
                res.status(200).send(challenge);
            } else {
                console.error('Webhook verification failed: tokens do not match');
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(400);
        }
    }
    
    // Recibir mensajes/eventos
    async handleIncoming(req, res) {
        const { connectionId } = req.params;
        
        // Responder inmediatamente a Meta (timeout es de 20s)
        res.status(200).send('EVENT_RECEIVED');
        
        try {
            // Verificar firma del payload (seguridad)
            const signature = req.headers['x-hub-signature-256'];
            if (!this.verifySignature(req.body, signature, connectionId)) {
                console.error('Invalid webhook signature');
                return;
            }
            
            const body = req.body;
            
            // Procesar cada entrada
            for (const entry of body.entry || []) {
                for (const change of entry.changes || []) {
                    if (change.value && change.value.messages) {
                        await this.processMessages(connectionId, change.value.messages);
                    }
                    
                    // Manejar otros eventos (status updates, etc.)
                    if (change.value && change.value.statuses) {
                        await this.processStatuses(connectionId, change.value.statuses);
                    }
                }
            }
            
        } catch (err) {
            console.error('Webhook processing error:', err);
            
            // Log error
            await db.query(
                `INSERT INTO meta_connection_logs (connection_id, event_type, event_data, created_at)
                 VALUES ($1, 'webhook_error', $2, NOW())`,
                [connectionId, JSON.stringify({ error: err.message })]
            );
        }
    }
    
    // Verificar firma HMAC
    async verifySignature(payload, signature, connectionId) {
        if (!signature) return false;
        
        // Obtener app secret (debería estar en env, no en DB)
        const appSecret = process.env.META_APP_SECRET;
        
        const expectedSignature = crypto
            .createHmac('sha256', appSecret)
            .update(JSON.stringify(payload))
            .digest('hex');
        
        return crypto.timingSafeEqual(
            Buffer.from(signature.replace('sha256=', '')),
            Buffer.from(expectedSignature)
        );
    }
    
    // Procesar mensajes entrantes
    async processMessages(connectionId, messages) {
        for (const message of messages) {
            const { id: messageId, from, timestamp, type } = message;
            
            // Guardar en tabla de mensajes (si tienes una)
            // Aquí es donde integras con tu lógica de negocio
            
            console.log(`New message ${messageId} from ${from} (type: ${type})`);
            
            // Log
            await db.query(
                `INSERT INTO meta_connection_logs (connection_id, event_type, event_data, created_at)
                 VALUES ($1, 'message_received', $2, to_timestamp($3))`,
                [connectionId, JSON.stringify(message), timestamp]
            );
            
            // Actualizar last_used_at
            await db.query(
                'UPDATE meta_connections SET last_used_at = NOW() WHERE id = $1',
                [connectionId]
            );
            
            // Aquí disparas tu lógica de procesamiento
            // Ej: await messageProcessor.process(message, connectionId);
        }
    }
    
    // Procesar estados de mensajes (sent, delivered, read)
    async processStatuses(connectionId, statuses) {
        for (const status of statuses) {
            console.log(`Message ${status.id} status: ${status.status}`);
            
            // Actualizar estado en tu base de datos si estás trackeando mensajes enviados
            await db.query(
                `INSERT INTO meta_connection_logs (connection_id, event_type, event_data, created_at)
                 VALUES ($1, 'message_status', $2, NOW())`,
                [connectionId, JSON.stringify(status)]
            );
        }
    }
}

module.exports = new WebhookController();
6. FRONTEND - COMPONENTES REACT
6.1 Componente de Conexión Principal
jsx
Copy
// components/WhatsAppConnection/WhatsAppManager.jsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { ConnectionCard } from './ConnectionCard';
import { OAuthModal } from './OAuthModal';
import { toast } from 'sonner';

export const WhatsAppManager = () => {
    const [oauthWindow, setOauthWindow] = useState(null);
    const [pendingState, setPendingState] = useState(null);
    
    // Fetch connections
    const { data: connections, refetch } = useQuery({
        queryKey: ['whatsapp-connections'],
        queryFn: async () => {
            const res = await axios.get('/api/whatsapp/connections');
            return res.data.data;
        }
    });
    
    // Initiate OAuth
    const connectMutation = useMutation({
        mutationFn: async () => {
            const res = await axios.post('/api/whatsapp/oauth/meta/init', {
                redirect_uri: window.location.origin + '/settings/whatsapp/callback'
            });
            return res.data.data;
        },
        onSuccess: ({ auth_url, state }) => {
            setPendingState(state);
            
            // Abrir popup centrado
            const width = 600;
            const height = 700;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;
            
            const popup = window.open(
                auth_url,
                'MetaOAuth',
                `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
            );
            
            setOauthWindow(popup);
            
            // Monitorear cierre del popup
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    setOauthWindow(null);
                    refetch(); // Recargar conexiones
                }
            }, 1000);
        }
    });
    
    // Escuchar mensajes del popup (callback)
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.origin !== window.location.origin) return;
            
            if (event.data.type === 'META_OAUTH_SUCCESS') {
                toast.success('WhatsApp conectado exitosamente');
                refetch();
            }
            
            if (event.data.type === 'META_OAUTH_ERROR') {
                toast.error('Error al conectar: ' + event.data.error);
            }
        };
        
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [refetch]);
    
    return (
        <div className="whatsapp-manager">
            <div className="header">
                <h2>Gestión de WhatsApp Business</h2>
                <button 
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                    className="btn-primary"
                >
                    {connectMutation.isPending ? 'Abriendo...' : '+ Conectar Número'}
                </button>
            </div>
            
            <div className="connections-grid">
                {connections?.map(conn => (
                    <ConnectionCard 
                        key={conn.id} 
                        connection={conn}
                        onDisconnect={() => refetch()}
                        onTest={() => {/* Abrir modal de prueba */}}
                    />
                ))}
                
                {connections?.length === 0 && (
                    <div className="empty-state">
                        <p>No hay números de WhatsApp conectados</p>
                        <button onClick={() => connectMutation.mutate()}>
                            Conectar ahora
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
6.2 Card de Conexión
jsx
Copy
// components/WhatsAppConnection/ConnectionCard.jsx
import React from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const ConnectionCard = ({ connection, onDisconnect }) => {
    const statusColors = {
        active: 'green',
        error: 'red',
        disconnected: 'gray',
        refreshing: 'yellow'
    };
    
    const disconnectMutation = useMutation({
        mutationFn: () => axios.delete(`/api/whatsapp/connections/${connection.id}`),
        onSuccess: onDisconnect
    });
    
    return (
        <div className={`connection-card status-${connection.status}`}>
            <div className="card-header">
                <div className="phone-number">
                    <span className="icon">📱</span>
                    <h3>{connection.meta_phone_number}</h3>
                    {connection.quality_rating && (
                        <span className={`quality-badge ${connection.quality_rating.toLowerCase()}`}>
                            {connection.quality_rating}
                        </span>
                    )}
                </div>
                <span className={`status-pill ${statusColors[connection.status]}`}>
                    {connection.status}
                </span>
            </div>
            
            <div className="card-body">
                <div className="info-row">
                    <span>Nombre:</span>
                    <strong>{connection.display_name || 'Sin nombre'}</strong>
                </div>
                <div className="info-row">
                    <span>Conectado:</span>
                    <strong>
                        {formatDistanceToNow(new Date(connection.connected_at), { 
                            addSuffix: true,
                            locale: es 
                        })}
                    </strong>
                </div>
                {connection.last_used_at && (
                    <div className="info-row">
                        <span>Último uso:</span>
                        <strong>
                            {formatDistanceToNow(new Date(connection.last_used_at), { 
                                addSuffix: true,
                                locale: es 
                            })}
                        </strong>
                    </div>
                )}
            </div>
            
            <div className="card-actions">
                <button 
                    className="btn-secondary"
                    onClick={() => {/* Abrir modal de prueba */}}
                >
                    Enviar Prueba
                </button>
                <button 
                    className="btn-danger"
                    onClick={() => {
                        if (confirm('¿Desconectar este número? Se perderán los mensajes pendientes.')) {
                            disconnectMutation.mutate();
                        }
                    }}
                    disabled={disconnectMutation.isPending}
                >
                    {disconnectMutation.isPending ? 'Desconectando...' : 'Desconectar'}
                </button>
            </div>
        </div>
    );
};
7. CRON JOBS Y MANTENIMIENTO
7.1 Renovación Automática de Tokens
JavaScript
Copy
// jobs/tokenRefresh.job.js
const cron = require('node-cron');
const db = require('../db');
const encryption = require('../services/encryption.service');
const axios = require('axios');

// Ejecutar todos los días a las 2 AM
cron.schedule('0 2 * * *', async () => {
    console.log('Starting token refresh job...');
    
    // Buscar tokens que expiran en menos de 7 días
    const expiringTokens = await db.query(
        `SELECT id, access_token_encrypted, meta_waba_id
         FROM meta_connections 
         WHERE status = 'active' 
         AND token_expires_at < NOW() + INTERVAL '7 days'`
    );
    
    for (const conn of expiringTokens.rows) {
        try {
            const token = encryption.decrypt(conn.access_token_encrypted);
            
            // Meta no permite "refrescar" un token de larga duración directamente
            // pero podemos verificar si sigue válido haciendo una llamada de prueba
            await axios.get(`https://graph.facebook.com/v18.0/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Si sigue válido, actualizamos la fecha de expiración teórica
            // (en realidad Meta renueva automáticamente si hay actividad)
            await db.query(
                `UPDATE meta_connections 
                 SET token_expires_at = NOW() + INTERVAL '60 days',
                     last_refresh_at = NOW(),
                     updated_at = NOW()
                 WHERE id = $1`,
                [conn.id]
            );
            
            console.log(`Token refreshed for connection ${conn.id}`);
            
        } catch (err) {
            console.error(`Failed to refresh token ${conn.id}:`, err.message);
            
            // Marcar para reconexión manual
            await db.query(
                `UPDATE meta_connections 
                 SET status = 'error',
                     connection_error = 'Token expired or invalid'
                 WHERE id = $1`,
                [conn.id]
            );
            
            // Notificar al usuario (email/push)
            await notifyUserReconnectionRequired(conn.id);
        }
    }
});

// Limpieza de states antiguos (más de 1 día)
cron.schedule('0 3 * * *', async () => {
    await db.query(
        `DELETE FROM oauth_states 
         WHERE created_at < NOW() - INTERVAL '1 day' OR used = true`
    );
});
8. SEGURIDAD Y PRODUCCIÓN
8.1 Checklist Pre-Deploy
[ ] Variables de entorno configuradas:
bash
Copy
META_APP_ID=
META_APP_SECRET=
ENCRYPTION_KEY= # 64 caracteres hex (32 bytes)
WEBHOOK_VERIFY_TOKEN= # Random seguro
BACKEND_URL=https://api.tuplataforma.com
FRONTEND_URL=https://app.tuplataforma.com
[ ] SSL/TLS activo en todos los endpoints
[ ] Rate limiting implementado: máximo 10 intentos OAuth por IP/hora
[ ] Logs sanitizados (nunca loggear tokens completos)
[ ] Webhooks validados con firma HMAC
[ ] Base de datos con encriptación en reposo (AWS RDS encryption/Azure)
[ ] Backups automáticos de la tabla meta_connections (sin tokens desencriptados)
[ ] Política de privacidad actualizada mencionando uso de Meta Business API
[ ] HTTPS obligatorio para redirect_uris
8.2 Manejo de Errores Comunes
Table
Error	Causa	Solución
Invalid redirect_uri	URL no registrada en Meta App	Agregar en developers.facebook.com → Configuración → URI de redirección OAuth válidos
Code expired	El usuario tardó más de 10 minutos	Implementar reintentos automáticos
Permissions error	El usuario no es admin del Business	Instruir al usuario que necesita permisos de administrador
WABA not found	El Business no tiene WhatsApp configurado	Redirigir a configuración previa en business.facebook.com
9. ESCALABILIDAD (Multi-Tenant Avanzado)
Si tu plataforma crecerá a miles de clientes:
9.1 Arquitectura de Microservicios
plain
Copy
┌─────────────────┐
│   API Gateway   │── Rate Limit por tenant_id
└────────┬────────┘
         │
    ┌────┴────┬────────────┐
    ▼         ▼            ▼
┌───────┐ ┌────────┐ ┌──────────┐
│OAuth  │ │Webhook │ │Messaging │
│Service│ │Worker  │ │Service   │
└───┬───┘ └────┬───┘ └────┬─────┘
    │          │          │
    └────┬─────┴────┬─────┘
         ▼          ▼
    ┌──────────────────┐
    │   Redis Cluster  │── Cache de tokens desencriptados (TTL 5min)
    └──────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌─────────┐
│PostgreSQL│ │SQS/Rabbit│── Cola de mensajes entrantes
│Master  │ │MQ        │
└────────┘ └─────────┘
9.2 Caché de Tokens
Para evitar desencriptar tokens constantemente (operación CPU intensiva):
JavaScript
Copy
// services/tokenCache.service.js
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

class TokenCache {
    async get(connectionId) {
        const cached = await redis.get(`whatsapp:token:${connectionId}`);
        if (cached) return cached;
        
        // Si no está en caché, obtener de DB, desencriptar y guardar en caché
        const result = await db.query(
            'SELECT access_token_encrypted FROM meta_connections WHERE id = $1',
            [connectionId]
        );
        
        if (result.rows.length === 0) return null;
        
        const token = encryption.decrypt(result.rows[0].access_token_encrypted);
        
        // Guardar por 5 minutos (menor tiempo = más seguro)
        await redis.setex(`whatsapp:token:${connectionId}`, 300, token);
        
        return token;
    }
    
    async invalidate(connectionId) {
        await redis.del(`whatsapp:token:${connectionId}`);
    }
}

module.exports = new TokenCache();
10. MONITOREO
10.1 Métricas Clave (Prometheus/Grafana)
JavaScript
Copy
// monitoring/metrics.js
const prometheus = require('prom-client');

const oauthAttempts = new prometheus.Counter({
    name: 'whatsapp_oauth_attempts_total',
    help: 'Total OAuth attempts',
    labelNames: ['tenant_id', 'status']
});

const webhookLatency = new prometheus.Histogram({
    name: 'whatsapp_webhook_duration_seconds',
    help: 'Webhook processing duration',
    buckets: [0.1, 0.5, 1, 2, 5]
});

const activeConnections = new prometheus.Gauge({
    name: 'whatsapp_active_connections',
    help: 'Number of active WhatsApp connections',
    labelNames: ['status']
});

// Actualizar métricas periódicamente
setInterval(async () => {
    const result = await db.query(
        'SELECT status, COUNT(*) FROM meta_connections GROUP BY status'
    );
    
    result.rows.forEach(row => {
        activeConnections.set({ status: row.status }, parseInt(row.count));
    });
}, 60000);
