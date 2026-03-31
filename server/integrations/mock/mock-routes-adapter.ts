import type {
  ComputeLegRequest,
  RouteMatrixElement,
  RouteMatrixRequest,
  RouteSnapshot,
  RoutesAdapter,
  RouteWaypoint,
} from "../google/routes/types.ts";
import type { ItineraryPlace } from "../../planner/types.ts";

export class MockRoutesAdapter implements RoutesAdapter {
  private readonly placesById: Map<string, ItineraryPlace>;

  constructor(places: ItineraryPlace[]) {
    this.placesById = new Map(places.map((place) => [place.place_id, place]));
  }

  async computeLeg(input: ComputeLegRequest): Promise<RouteSnapshot> {
    const origin = resolveWaypoint(input.origin, this.placesById);
    const destination = resolveWaypoint(input.destination, this.placesById);
    const distanceMeters = haversineMeters(origin.lat, origin.lng, destination.lat, destination.lng);
    const durationMinutes = estimateDurationMinutes(distanceMeters, input.travelMode);

    return {
      provider: "google_routes",
      mode: input.travelMode,
      distanceMeters: Math.round(distanceMeters),
      durationMinutes,
      staticDurationMinutes: durationMinutes,
      polyline: `${origin.lat},${origin.lng};${destination.lat},${destination.lng}`,
      warnings: [],
      steps: input.includeSteps
        ? [
            {
              instruction: `Travel ${input.travelMode} to next stop`,
              travelMode: input.travelMode,
              distanceMeters: Math.round(distanceMeters),
              durationMinutes,
              polyline: `${origin.lat},${origin.lng};${destination.lat},${destination.lng}`,
            },
          ]
        : [],
    };
  }

  async computeMatrix(input: RouteMatrixRequest): Promise<RouteMatrixElement[]> {
    const elements: RouteMatrixElement[] = [];

    input.origins.forEach((origin, originIndex) => {
      input.destinations.forEach((destination, destinationIndex) => {
        const originPoint = resolveWaypoint(origin, this.placesById);
        const destinationPoint = resolveWaypoint(destination, this.placesById);
        const distanceMeters = haversineMeters(
          originPoint.lat,
          originPoint.lng,
          destinationPoint.lat,
          destinationPoint.lng
        );

        elements.push({
          originIndex,
          destinationIndex,
          distanceMeters: Math.round(distanceMeters),
          durationMinutes: estimateDurationMinutes(distanceMeters, input.travelMode),
          status: "ok",
          condition: "ROUTE_EXISTS",
        });
      });
    });

    return elements;
  }
}

function resolveWaypoint(
  waypoint: RouteWaypoint,
  placesById: Map<string, ItineraryPlace>
): { lat: number; lng: number } {
  if (waypoint.location) {
    return waypoint.location;
  }

  if (waypoint.placeId) {
    const place = placesById.get(waypoint.placeId);
    if (!place) {
      throw new Error(`Mock route waypoint place not found: ${waypoint.placeId}`);
    }
    return { lat: place.lat, lng: place.lng };
  }

  throw new Error("MockRoutesAdapter requires waypoint.location or waypoint.placeId.");
}

function estimateDurationMinutes(distanceMeters: number, mode: ComputeLegRequest["travelMode"]): number {
  const km = distanceMeters / 1000;
  const speedKmh =
    mode === "walk" ? 4.8 : mode === "transit" ? 22 : mode === "taxi" ? 30 : 34;
  const base = (km / speedKmh) * 60;
  const floor = mode === "walk" ? 6 : 8;
  return Math.max(floor, Math.round(base + (mode === "walk" ? 2 : 4)));
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const originLat = toRadians(lat1);
  const targetLat = toRadians(lat2);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(targetLat) * Math.sin(dLng / 2) ** 2;

  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}
