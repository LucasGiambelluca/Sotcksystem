import axios from 'axios';

async function testNominatim() {
    const neighborhood = "Palihue";
    const city = "Bahia Blanca";
    const url = `https://nominatim.openstreetmap.org/search?q=${neighborhood},+${city}&format=json&polygon_geojson=1`;

    try {
        console.log(`Searching for ${neighborhood} in ${city}...`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'StockSystem-Bot-Validation'
            }
        });

        if (response.data.length > 0) {
            const first = response.data[0];
            console.log('Match found:', first.display_name);
            if (first.geojson) {
                console.log('GeoJSON content type:', first.geojson.type);
                if (first.geojson.type === 'Polygon' || first.geojson.type === 'MultiPolygon') {
                    console.log('✅ POLYGON RETRIEVED SUCCESSFULLY');
                    // console.log(JSON.stringify(first.geojson, null, 2));
                } else {
                    console.warn('⚠️ Match found but it is not a polygon:', first.geojson.type);
                }
            }
        } else {
            console.log('❌ No results found.');
        }
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}

testNominatim();
