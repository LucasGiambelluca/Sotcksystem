
const { Mutex } = require('async-mutex');

const mutex = new Mutex();
const phone = '5491100000000';

console.log('🔒 Testing Mutex Concurrency...');

async function simulateMessage(id, delay) {
    const release = await mutex.acquire();
    console.log(`[${id}] Acquired Lock`);
    try {
        console.log(`[${id}] Processing...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        console.log(`[${id}] Finished`);
    } finally {
        release();
        console.log(`[${id}] Released Lock`);
    }
}

// Fire 3 messages at once
Promise.all([
    simulateMessage('MSG_A', 2000),
    simulateMessage('MSG_B', 500),
    simulateMessage('MSG_C', 1000)
]);
