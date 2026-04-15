async function testAudio() {
  try {
    const res = await fetch('http://127.0.0.1:3001/api/official/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object: "whatsapp_business_account",
        entry: [{
          id: "0",
          changes: [{
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "1029241326937914" },
              contacts: [{ profile: { name: "Test User" }, wa_id: "542914163935" }],
              messages: [{
                from: "542914163935",
                id: "test_" + Date.now(),
                type: "text",
                text: { body: "hola" },
                timestamp: Math.floor(Date.now() / 1000).toString()
              }]
            },
            field: "messages"
          }]
        }]
      })
    });
    console.log('Response status:', res.status);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testAudio();
