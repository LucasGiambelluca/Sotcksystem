require('dotenv').config();
const { default: conversationRouter } = require('./src/core/engine/conversation.router');
const { supabase } = require('./src/config/database');
const { logger } = require('./src/utils/logger');

// Force logger to output to console for local testing
logger.level = 'debug';

async function test() {
    try {
        console.log("Testing Router end-to-end...");
        
        // Clean up previous drafts for number
        await supabase.from('draft_orders').delete().eq('phone', '5492915093499');

        const context = {
            messageId: 'test-1234',
            startedAt: new Date().toISOString()
        };

        const res = await conversationRouter.processMessage('5492915093499', "quiero 1 pizza napoletana", 'TestUser', context);
        console.log("Router Response:", JSON.stringify(res, null, 2));

        const { data: draft } = await supabase.from('draft_orders').select('*').eq('phone', '5492915093499').order('created_at', { ascending: false }).limit(1);
        console.log("Final Draft Order:", JSON.stringify(draft, null, 2));

    } catch (e) {
        console.error(e);
    }
}

test();
