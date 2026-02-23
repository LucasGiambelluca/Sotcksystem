import { Router } from 'express';
import { LogisticsController } from '../controllers/LogisticsController';

const router = Router();
const controller = new LogisticsController();

// Arrow functions in class properties automatically bind 'this', so .bind() is unnecessary/redundant
router.post('/routes/:id/optimize', controller.optimizeRoute);
router.post('/routes/:id/sequence', controller.updateSequence);
router.get('/routes/:id/navigation-url', controller.getNavigationUrl);
router.post('/routes/:id/share', controller.shareRoute);

export default router;
