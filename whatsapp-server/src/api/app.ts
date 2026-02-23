import express from 'express';
import cors from 'cors';
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

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:8080';
const allowedOrigins = [corsOrigin, 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json());

// --- Health Check ---
app.get('/health', (_req, res) => {
    const status = whatsappClient.getStatus();
    const checks = {
        database: false,
        redis: false,
        whatsapp: status === 'WORKING',
        timestamp: new Date().toISOString()
    };
    
    const statusCode = checks.whatsapp ? 200 : 503;

    res.status(statusCode).json({
        status: checks.whatsapp ? 'healthy' : 'degraded',
        checks,
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

// --- API Routes ---
app.use('/api/flows', requireAuth, flowRoutes);
app.use('/api/logistics', requireAuth, logisticsRoutes);
app.use('/api/claims', requireAuth, claimsRoutes);
app.use('/api/driver', driverRoutes); // Public endpoint for drivers

// --- External Services & WhatsApp specific routes ---
app.use('/api/groups', groupsRoutes);
app.use('/api', whatsappRoutes);
app.use('/api', systemRoutes);

export default app;
