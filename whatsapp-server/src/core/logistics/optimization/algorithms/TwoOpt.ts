import { Point } from './NearestNeighbor';

export class TwoOpt {
    /**
     * Improves a tour using the 2-opt local search algorithm.
     * Iteratively swaps edges to reduce total distance.
     */
    static optimize<T extends Point>(
        tour: T[], 
        distanceFn: (a: Point, b: Point) => number,
        maxIterations: number = 100
    ): T[] {
        let improved = true;
        let count = 0;
        const newTour = [...tour];

        while (improved && count < maxIterations) {
            improved = false;
            count++;

            for (let i = 1; i < newTour.length - 2; i++) {
                for (let j = i + 1; j < newTour.length - 1; j++) {
                    // Check if swapping edges (i, i+1) and (j, j+1) reduces length
                    // Old edges: (i-1 -> i) + (i -> i+1) ... (j -> j+1)
                    // We look at segment from i to j
                    
                    const pA = newTour[i-1];
                    const pB = newTour[i];
                    const pC = newTour[j];
                    const pD = newTour[j+1];

                    const dAB = distanceFn(pA, pB);
                    const dCD = distanceFn(pC, pD);
                    const dAC = distanceFn(pA, pC);
                    const dBD = distanceFn(pB, pD);

                    if (dAC + dBD < dAB + dCD) {
                        // Swap
                        this.reverse(newTour, i, j);
                        improved = true;
                    }
                }
            }
        }
        
        return newTour;
    }

    private static reverse(arr: any[], i: number, j: number) {
        let start = i;
        let end = j;
        while (start < end) {
            const temp = arr[start];
            arr[start] = arr[end];
            arr[end] = temp;
            start++;
            end--;
        }
    }
}
