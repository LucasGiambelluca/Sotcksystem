export interface Point {
    id: string;
    lat: number;
    lng: number;
    [key: string]: any;
}

export interface OptimizationResult<T> {
    sequence: T[];
    totalDistance: number;
}

export class NearestNeighbor {
    /**
     * Solves TSP using Nearest Neighbor heuristic.
     * @param start Origin point
     * @param points List of points to visit
     * @param distanceFn Function to calculate distance between two points
     */
    static solve<T extends Point>(
        start: Point, 
        points: T[], 
        distanceFn: (a: Point, b: Point) => number
    ): T[] {
        const unvisited = [...points];
        const path: T[] = [];
        let current = start;

        while (unvisited.length > 0) {
            let nearestIdx = -1;
            let minDist = Infinity;

            for (let i = 0; i < unvisited.length; i++) {
                const dist = distanceFn(current, unvisited[i]);
                if (dist < minDist) {
                    minDist = dist;
                    nearestIdx = i;
                }
            }

            const nearest = unvisited.splice(nearestIdx, 1)[0];
            path.push(nearest);
            current = nearest;
        }

        return path;
    }
}
