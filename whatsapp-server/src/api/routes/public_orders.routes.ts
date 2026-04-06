import { Router } from 'express';
import { PublicOrderController } from '../controllers/PublicOrderController';

const router = Router();

// Endpoint público para recibir pedidos directos del catálogo
// No requiere autenticación ya que es para clientes finales
router.post('/submit-order', PublicOrderController.submitOrder);
router.post('/calculate-shipping', PublicOrderController.calculateShipping);

export default router;
