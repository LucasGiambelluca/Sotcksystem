
const axios = require('axios');
require('dotenv').config();

async function test() {
    const gmapsKey = process.env.GOOGLE_MAPS_API_KEY;
    const address = "san martin 10";
    const context = "Bahia Blanca";
    
    console.log(`Searching for: ${address} in ${context}`);
    const query = `${address}, ${context}`;
    const geoRes = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${gmapsKey}&region=ar`);
    
    if (geoRes.data.status === 'OK') {
        const result = geoRes.data.results[0];
        console.log("Success!");
        console.log("Formatted Address:", result.formatted_address);
        console.log("Coords:", result.geometry.location);
    } else {
        console.log("Failed:", geoRes.data.status);
    }
}

test();
