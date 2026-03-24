const axios = require('axios');
require('dotenv').config();

async function testSend(to) {
    const token = process.env.WHATSAPP_CLOUD_TOKEN;
    const phoneId = '1029241326937914';

    console.log(`\n--- Testing with recipient: ${to} ---`);
    console.log('Phone ID:', phoneId);
    console.log('Token (first 10 chars):', token.substring(0, 10));

    const url = `https://graph.facebook.com/v22.0/${phoneId}/messages`;
    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: { body: `Test message to ${to}` }
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ Success for ${to}!`);
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error(`❌ Error for ${to}!`);
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

async function runTests() {
    await testSend('5492915093499'); // With 9
    await testSend('542915093499');  // Without 9
}

runTests();
