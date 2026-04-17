const fs = require('fs');
const pt = {lat: -38.7365414, lng: -62.2761179};
function isPointInPolygon(point, geojson) {
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
    if (geojson.type === 'Polygon') return checkRing(geojson.coordinates[0]);
    if (geojson.type === 'MultiPolygon') return geojson.coordinates.some(c => checkRing(c[0]));
    return false;
}
const mapData = JSON.parse(fs.readFileSync('./client/src/data/bahia-neighborhoods.json', 'utf8'));
const inFeatures = mapData.features.filter(f => isPointInPolygon(pt, f.geometry));
console.log('Godoy Cruz 327 matches:', inFeatures.map(f => f.properties.name));
