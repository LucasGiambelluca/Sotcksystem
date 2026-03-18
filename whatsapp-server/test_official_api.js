const axios = require('axios');
require('dotenv').config();

async function testSend() {
    const token = process.env.WHATSAPP_CLOUD_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const to = '5492915093499'; // Lucas number from logs

    console.log('Testing with:');
    console.log('Phone ID:', phoneId);
    console.log('Token (first 10 chars):', token.substring(0, 10));

    const url = `https://graph.facebook.com/v22.0/${phoneId}/messages`;
    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: { body: 'Test message from server' }
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Success!');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error!');
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

testSend();
