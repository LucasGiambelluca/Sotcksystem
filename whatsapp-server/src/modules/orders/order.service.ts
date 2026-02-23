export interface Order {
    id: string;
    userId: string;
    items: any[];
    total: number;
    status: 'pending' | 'confirmed' | 'delivered';
    createdAt: Date;
}

export class OrderService {
    async createOrder(userId: string, items: any[]): Promise<Order> {
        // Logic to create order in DB
        const order: Order = {
            id: `ORD-${Date.now()}`,
            userId,
            items,
            total: items.reduce((acc, item) => acc + item.price * item.quantity, 0),
            status: 'pending',
            createdAt: new Date()
        };
        console.log('Order created:', order);
        return order;
    }

    async getOrder(orderId: string): Promise<Order | null> {
        // Logic to fetch order
        return null;
    }

    async updateOrderStatus(orderId: string, status: Order['status']) {
        // Logic to update status
        console.log(`Order ${orderId} updated to ${status}`);
    }
}
