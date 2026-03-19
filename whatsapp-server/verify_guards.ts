
import { CreateOrderExecutor } from './src/core/executors/CreateOrderExecutor';
import { OrderSummaryExecutor } from './src/core/executors/OrderSummaryExecutor';
import 'dotenv/config';

async function testGuards() {
    const summaryExecutor = new OrderSummaryExecutor();
    const createExecutor = new CreateOrderExecutor();

    console.log('--- Testing OrderSummary with 0 items ---');
    const summaryResult = await summaryExecutor.execute({}, { order_items: [] } as any, {});
    console.log('Summary Result:', JSON.stringify(summaryResult, null, 2));

    console.log('\n--- Testing CreateOrder with 0 items ---');
    const createResult = await createExecutor.execute({}, { order_items: [], phone: '5491100000000' } as any, {});
    console.log('Create Result:', JSON.stringify(createResult, null, 2));
}

testGuards().catch(console.error);
