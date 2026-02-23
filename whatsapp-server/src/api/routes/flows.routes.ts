import { Router } from 'express';
import { FlowController } from '../controllers/FlowController';

const router = Router();
const controller = new FlowController();

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);
router.post('/:id/toggle', controller.toggleActive);

export default router;
