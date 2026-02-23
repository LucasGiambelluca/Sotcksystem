import axios from 'axios';

export interface LatLng {
  lat: number;
  lng: number;
}

export class DistanceCalculator {
  private apiKey: string;
  private useGoogleMatrix: boolean;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    // Feature flag: Enable only if explicitly set to 'true' to control costs
    this.useGoogleMatrix = process.env.USE_GOOGLE_MATRIX === 'true'; 
  }

  /**
   * Calculates the distance matrix (N x M)
   * Uses Hybrid Strategy: Haversine by default, Google Matrix for refinement if enabled.
   */
  async getDistanceMatrix(
    origins: LatLng[], 
    destinations: LatLng[]
  ): Promise<number[][]> {
    
    // FASE 1: Haversine (Cheap, Fast, Good enough for local sorting)
    const haversineMatrix = this.calculateHaversineMatrix(origins, destinations);
    
    // FASE 2: Refinement (Optional)
    // If we were implementing a strict TSP with time windows, we'd need real traffic data.
    // For now, Haversine is usually sufficient for "clustering" and Nearest Neighbor.
    // We will stick to Haversine for the "Fast" strategy.
    
    // If Google Matrix is absolutely needed for final ETA calculation, we can add it here.
    
    return haversineMatrix;
  }

  private calculateHaversineMatrix(origins: LatLng[], destinations: LatLng[]): number[][] {
    return origins.map(origin => 
      destinations.map(dest => this.haversine(origin, dest))
    );
  }

  /**
   * Calculates Haversine distance in KM
   */
  public haversine(start: LatLng, end: LatLng): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(end.lat - start.lat);
    const dLng = this.toRad(end.lng - start.lng);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(start.lat)) * Math.cos(this.toRad(end.lat)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }


  /**
   * Get real driving time/distance for a specific segment using Google
   * Use this for final ETA calculation, not for the optimization loop.
   */
  async getRealDrivingMetrics(origin: LatLng, destination: LatLng): Promise<{ distanceKm: number, durationMin: number }> {
      try {
         // STRATEGY: Use Google Maps if key exists, otherwise OSRM (Free)
         if (this.apiKey) {
             const originStr = `${origin.lat},${origin.lng}`;
             const destStr = `${destination.lat},${destination.lng}`;
             
             const response = await axios.get(
                `https://maps.googleapis.com/maps/api/distancematrix/json`,
                {
                    params: {
                        origins: originStr,
                        destinations: destStr,
                        key: this.apiKey,
                        mode: 'driving'
                    }
                }
             );

             if (response.data.status === 'OK') {
                 const element = response.data.rows[0].elements[0];
                 if (element.status === 'OK') {
                     return {
                         distanceKm: element.distance.value / 1000,
                         durationMin: element.duration.value / 60
                     };
                 }
             }
             throw new Error('Google Matrix fallback');
         } else {
             // OSRM (Open Source Routing Machine) - Free
             // Demo server: http://router.project-osrm.org
             // Format: /route/v1/driving/{lon},{lat};{lon},{lat}?overview=false
             const url = `http://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
             const response = await axios.get(url);

             if (response.data.code === 'Ok' && response.data.routes.length > 0) {
                 const route = response.data.routes[0];
                 return {
                     distanceKm: route.distance / 1000,
                     durationMin: route.duration / 60
                 };
             }
             throw new Error('OSRM failed');
         }

     } catch (e) {
         console.warn('[DistanceCalculator] API failed, using fallback.', e);
         const dist = this.haversine(origin, destination);
         return {
             distanceKm: dist * 1.3,
             durationMin: (dist * 1.3 / 25) * 60
         };
     }
  }
}
