import { FlowEngine } from './flow.engine';
import orderService from '../../services/OrderService';
import slotService from '../../services/DeliverySlotService'; // Adjust path if needed

// Initialize Engine with Services
const engine = new FlowEngine(undefined, orderService, slotService);

export default engine;
