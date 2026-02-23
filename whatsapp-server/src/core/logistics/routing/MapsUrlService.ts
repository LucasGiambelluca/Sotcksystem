export interface RouteSegment {
  segment_number: number;
  start_stop: number;
  end_stop: number;
  url: string;
}

export interface NavigationUrls {
  primary_url: string;
  total_stops: number;
  requires_split: boolean;
  segments?: RouteSegment[];
  message?: string;
}

export class MapsUrlService {
  private readonly MAX_WAYPOINTS_WEB = 9;  // Google Maps limit (1 origin + 1 dest + 8 waypoints = 10 points URL limit often, sometimes 25)
  // Standard free URL limit is often cited as 10 total points including origin/dest.
  // We'll be conservative with 9 waypoints + Origin + Dest = 11 points (might be too many).
  // Safest is Origin + Dest + 9 Waypoints.

  generateNavigationUrl(
    origin: string,
    waypoints: Array<{ address: string; place_id?: string }>,
    destination: string
  ): NavigationUrls {

    // If we have too many waypoints, we must split
    if (waypoints.length > this.MAX_WAYPOINTS_WEB) {
      return this.generateSplitRoute(origin, waypoints, destination);
    }

    const url = this.constructGoogleMapsUrl(origin, waypoints, destination);

    return {
      primary_url: url,
      total_stops: waypoints.length + 1, // Waypoints + Dest
      requires_split: false,
      segments: [{
        segment_number: 1,
        start_stop: 1,
        end_stop: waypoints.length + 1,
        url
      }]
    };
  }

  private constructGoogleMapsUrl(
    origin: string, 
    waypoints: Array<{ address: string; place_id?: string }>, 
    destination: string
  ): string {
    const baseUrl = 'https://www.google.com/maps/dir/?api=1';
    const originParam = `origin=${encodeURIComponent(origin)}`;
    const destParam = `destination=${encodeURIComponent(destination)}`;
    
    let waypointsParam = '';
    if (waypoints.length > 0) {
      const wp = waypoints.map(w => encodeURIComponent(w.address)).join('|');
      waypointsParam = `&waypoints=${wp}`;
      
      // Optionally add place_ids if available for better precision
      // const wpIds = waypoints.map(w => w.place_id).filter(Boolean);
      // if (wpIds.length === waypoints.length) { ... }
    }

    return `${baseUrl}&${originParam}&${destParam}${waypointsParam}&travelmode=driving`;
  }

  private generateSplitRoute(
    origin: string,
    allWaypoints: Array<{ address: string }>,
    finalDestination: string
  ): NavigationUrls {
    const segments: RouteSegment[] = [];
    
    // We treat the Full List as: [Origin] -> [WP1...WPn] -> [FinalDestination]
    // To share continuity, Segment 1 ends at WP_x. Segment 2 starts at WP_x.
    
    const maxPerSegment = this.MAX_WAYPOINTS_WEB; // Intermediate stops per URL
    
    // Combine all points: [Start, ...WPs, End]
    const allPoints = [
        { address: origin },
        ...allWaypoints,
        { address: finalDestination }
    ];

    let currentIndex = 0;
    let segmentCount = 1;

    // While we have enough points for a segment (at least Start + End)
    while (currentIndex < allPoints.length - 1) {
        // Determine segment end index
        // We take "Origin" (1) + "Max Waypoints" (9) + "Dest" (1) = 11 points max?
        // Let's stick to Origin + 8 Waypoints + Destination = 10 points per URL.
        const segmentCapacity = 8; 
        
        let remaining = allPoints.length - 1 - currentIndex;
        let take = Math.min(remaining, segmentCapacity + 1); // +1 because we need a destination
        
        let endIndex = currentIndex + take;
        
        const segOrigin = allPoints[currentIndex].address;
        const segDest = allPoints[endIndex].address;
        const segWaypoints = allPoints.slice(currentIndex + 1, endIndex); // Exclude origin/dest
        
        const url = this.constructGoogleMapsUrl(
            segOrigin, 
            segWaypoints, 
            segDest
        );

        segments.push({
            segment_number: segmentCount,
            start_stop: currentIndex + 1, // logical index 1-based
            end_stop: endIndex + 1,
            url
        });

        // The destination of this segment becomes the origin of the next
        currentIndex = endIndex; 
        segmentCount++;
    }

    return {
        primary_url: segments[0].url,
        total_stops: allWaypoints.length + 1,
        requires_split: true,
        segments: segments,
        message: `Ruta dividida en ${segments.length} partes por límite de Google Maps.`
    };
  }
}
