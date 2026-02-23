
import { Router } from 'express';
import { LogisticsController } from '../controllers/LogisticsController';

const router = Router();
const controller = new LogisticsController();

// Public driver endpoints (No Auth Middleware applied in index.ts for this router)
router.get('/routes/:id', controller.getDriverRoute);
router.post('/orders/:id/status', controller.updateOrderDeliveryStatus);

export default router;
