import cron from 'node-cron';
import { supabase } from '../config/database';

/**
 * StockCronService
 * Runs at 06:00 AM America/Argentina/Buenos_Aires every day.
 * Restores the stock of all products that have auto_refill = true
 * to their configured auto_refill_qty value.
 *
 * The 06:00 AM cutoff ensures:
 *  - The local is guaranteed closed (no pending orders).
 *  - The "new operating day" starts with a clean, restocked inventory.
 */
export class StockCronService {
    private job: cron.ScheduledTask | null = null;

    start() {
        // Cron: 0 6 * * * = Every day at 06:00:00 AM
        this.job = cron.schedule('0 6 * * *', async () => {
            console.log('[StockCron] ⏰ 06:00 AM — Running daily stock auto-refill...');
            await this.runRefill();
        }, {
            timezone: 'America/Argentina/Buenos_Aires',
        });

        console.log('[StockCron] ✅ Daily stock auto-refill scheduled at 06:00 AM (Buenos Aires).');
    }

    stop() {
        this.job?.stop();
    }

    /**
     * Performs the actual stock reset.
     * Can also be called manually from an admin endpoint for testing.
     */
    async runRefill(): Promise<{ updated: number; errors: number }> {
        let updated = 0;
        let errors = 0;

        try {
            // Fetch all products that have auto-refill enabled
            const { data: products, error: fetchErr } = await supabase
                .from('products')
                .select('id, name, auto_refill_qty')
                .eq('auto_refill', true)
                .eq('is_deleted', false);

            if (fetchErr) {
                console.error('[StockCron] Error fetching auto-refill products:', fetchErr.message);
                return { updated: 0, errors: 1 };
            }

            if (!products || products.length === 0) {
                console.log('[StockCron] No products configured for auto-refill.');
                return { updated: 0, errors: 0 };
            }

            // Bulk update stock for all auto-refill products
            for (const product of products) {
                const { error: updateErr } = await supabase
                    .from('products')
                    .update({ stock: product.auto_refill_qty })
                    .eq('id', product.id);

                if (updateErr) {
                    console.error(`[StockCron] Error updating product ${product.name}:`, updateErr.message);
                    errors++;
                } else {
                    console.log(`[StockCron] ✅ ${product.name} → stock restored to ${product.auto_refill_qty}`);
                    updated++;
                }
            }

            console.log(`[StockCron] Done. ${updated} products updated, ${errors} errors.`);
        } catch (err: any) {
            console.error('[StockCron] Unexpected error:', err.message);
            errors++;
        }

        return { updated, errors };
    }
}

export const stockCronService = new StockCronService();
