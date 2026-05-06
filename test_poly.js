
const isPointInPolygon = (point, geojson) => {
    if (!geojson || !geojson.type || !geojson.coordinates) return false;

    const checkRing = (coords) => {
        let inside = false;
        for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
            const xi = coords[i][1], yi = coords[i][0];
            const xj = coords[j][1], yj = coords[j][0];
            
            const intersect = ((yi > point.lng) !== (yj > point.lng))
                && (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    if (geojson.type === 'Polygon') {
        return checkRing(geojson.coordinates[0]);
    } 
    return false;
};

// Test 1: Point inside a simple square
const poly1 = {
    type: 'Polygon',
    coordinates: [[[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]] // [lng, lat]
};
const point1 = { lat: 15, lng: 15 };
console.log('Test 1 (Inside):', isPointInPolygon(point1, poly1)); // Expect true

// Test 2: Point outside
const point2 = { lat: 5, lng: 5 };
console.log('Test 2 (Outside):', isPointInPolygon(point2, poly1)); // Expect false

// Test 3: Bahia Blanca real-ish poly
// Bahia Blanca is roughly around -38.7, -62.2
const bahiapoly = {
    type: 'Polygon',
    coordinates: [[
        [-62.28, -38.72],
        [-62.25, -38.72],
        [-62.25, -38.70],
        [-62.28, -38.70],
        [-62.28, -38.72]
    ]]
};
const addressPoint = { lat: -38.71, lng: -62.27 }; // Inside
console.log('Test 3 (BB Inside):', isPointInPolygon(addressPoint, bahiapoly)); // Expect true
