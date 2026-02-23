
import { Router } from 'express';
import { ClaimsController } from '../controllers/ClaimsController';

const router = Router();
const controller = new ClaimsController();

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.patch('/:id', controller.update);

export default router;
