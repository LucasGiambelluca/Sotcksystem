async function testValidation() {
    const addresses = [
        "San Martin 88", // SHOLD BE BLOCKED
        "Belgrano 10"    // SHOULD BE ALLOWED
    ];

    for (const address of addresses) {
        console.log(`Testing address: ${address}...`);
        try {
            const resp = await fetch('http://localhost:3001/api/public/validate-location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address })
            });
            const data = await resp.json();
            console.log(`Result: ${data.allowed ? '✅ ALLOWED' : '❌ BLOCKED'} | Message: ${data.error || 'OK'}`);
        } catch (e) {
            console.error(`Error testing ${address}:`, e.message);
        }
        console.log('---');
    }
}

testValidation();
