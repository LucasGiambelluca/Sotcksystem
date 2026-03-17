import express from 'express';
import cors from 'cors';
// import rateLimit from 'express-rate-limit'; // Disabled temporarily due to Windows npm EPERM bug
import { requireAuth } from '../middleware/auth';
import flowRoutes from './routes/flows.routes';
import logisticsRoutes from './routes/logistics.routes';
import claimsRoutes from './routes/claims.routes';
import driverRoutes from './routes/driver.routes';
import groupsRoutes from './routes/groups.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import systemRoutes from './routes/system.routes';
import { whatsappClient } from '../infrastructure/whatsapp/WhatsAppClient';

const app = express();

// --- Rate Limiting: Protección contra DDoS y abuso de API ---
/*
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,   // 1 minute window
    max: 100,              // Max 100 requests per IP per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Intenta de nuevo en 1 minuto.' }
});

const whatsappApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,               // Stricter limit for WhatsApp webhook routes
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit alcanzado en la API de WhatsApp.' }
});

app.use(globalLimiter);
*/

// --- CORS: soporta múltiples orígenes separados por coma en CORS_ORIGIN ---
// Ejemplo: CORS_ORIGIN=https://panel.midominio.com,https://midominio.com
const corsEnv = process.env.CORS_ORIGIN || 'http://localhost:8080';
const allowedOrigins = [
    ...corsEnv.split(',').map(o => o.trim()).filter(Boolean),
    // Siempre permitir localhost para desarrollo
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
];

app.use(cors({
    origin: function (origin, callback) {
        // Permitir requests sin origin (e.g. Postman, curl, mobile apps, mismo servidor)
        if (!origin) return callback(null, true);
        if (!allowedOrigins.includes(origin)) {
            console.error('CORS Error: Origin not allowed:', origin);
            return callback(new Error(`CORS: origin "${origin}" not allowed`), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json({
    verify: (req: any, _res, buf) => {
        if (req.originalUrl && req.originalUrl.includes('webhook')) {
            req.rawBody = buf;
            console.log(`[Debug] Captured rawBody for ${req.originalUrl}, length: ${buf.length}`);
        }
    }
}));

// --- Health Check ---
// Siempre retorna 200 para que Docker no reinicie el contenedor.
// El campo "whatsapp" en checks indica si el bot está conectado.
app.get('/health', (_req, res) => {
    const waStatus = whatsappClient.getStatus();
    const isConnected = waStatus === 'WORKING';

    res.status(200).json({
        status: isConnected ? 'healthy' : 'degraded',
        checks: {
            server: true,
            whatsapp: isConnected,
            whatsapp_status: waStatus,
            timestamp: new Date().toISOString(),
        },
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

// --- API Routes ---
app.use('/api/flows', requireAuth, flowRoutes);
app.use('/api/logistics', requireAuth, logisticsRoutes);
app.use('/api/claims', requireAuth, claimsRoutes);
app.use('/api/driver', driverRoutes); // Public endpoint for drivers

import path from 'path';

import whatsappWebhooks from './routes/whatsapp.webhooks';

// --- External Services & WhatsApp specific routes ---
app.use('/api/groups', groupsRoutes);
app.use('/api', whatsappRoutes);  // Limiter disabled temporarily
app.use('/api/official', whatsappWebhooks); // Official Webhook endpoint
app.use('/api', systemRoutes);

// --- STATIC FRONTEND SERVING (Unified Container) ---
// Serve static client files under /elpollocomilon
const clientBuildPath = path.join(__dirname, '../../../client/dist');
app.use('/elpollocomilon', express.static(clientBuildPath));

// Catch-all route to serve index.html for React Router handling
app.get('/elpollocomilon/*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
});

export default app;
