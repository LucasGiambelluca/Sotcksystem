import orderService from '../../services/OrderService';
import { SchedulingService } from '../../modules/scheduling/scheduling.service';
import { BaileysAdapter } from '../gateway/baileys.adapter';

export class ActionHandler {
    private orderService = orderService;
    private schedulingService: SchedulingService;
    private gateway: BaileysAdapter;

    constructor(gateway: BaileysAdapter) {
        this.gateway = gateway;
        this.schedulingService = new SchedulingService();
    }

    async executeAction(action: any, context: any) {
        console.log(`Executing action: ${action.type}`, action);

        switch (action.type) {
            case 'send_message':
                await this.gateway.sendMessage(context.userId, { text: action.text });
                break;
            
            case 'create_order':
                await this.orderService.createOrder({
                    items: context.cart,
                    phone: context.userId, // Phone is the key in chat context
                    total: context.total || 0,
                    chatContext: context
                });
                break;
            
            case 'check_availability':
                await this.schedulingService.checkAvailability(new Date());
                break;

            default:
                console.warn(`Unknown action type: ${action.type}`);
        }
    }
}
