/**
 * Clear Operational Data Script
 * Removes orders, sessions, and operational data while preserving configuration.
 * Usage: npx ts-node src/scripts/index.ts clear
 */
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { supabase } from '../config/database';

const operationalTables = [
    'route_orders',
    'order_items',
    'order_status_history',
    'orders',
    'whatsapp_messages',
    'whatsapp_conversations',
    'flow_executions',
    'chat_sessions',
];

export async function clearOperationalDb(): Promise<void> {
    console.log('🧹 Clearing operational data...\n');
    console.log('⚠️  This will delete orders, messages, and sessions.');
    console.log('    Products, flows, and configuration will be preserved.\n');

    for (const table of operationalTables) {
        process.stdout.write(`  🗑️  Clearing ${table}... `);
        const { error } = await supabase.from(table).delete().not('id', 'is', null);
        console.log(error ? `❌ ${error.message}` : '✅');
    }

    console.log('\n✅ Operational data cleared successfully.\n');
}
