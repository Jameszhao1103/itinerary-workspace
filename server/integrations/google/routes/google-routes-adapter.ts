import { GoogleHttpClient } from "../shared/http-client.ts";
import {
  COMPUTE_ROUTE_MATRIX_FIELD_MASK,
  resolveComputeRouteFieldMask,
} from "./field-masks.ts";
import type {
  ComputeLegRequest,
  GoogleComputeRouteMatrixRequest,
  GoogleComputeRoutesRequest,
  GoogleComputeRoutesResponse,
  GoogleRouteStep,
  GoogleRouteMatrixResponseElement,
  GoogleRouteTravelMode,
  GoogleRoutingPreference,
  RouteMatrixElement,
  RouteMatrixRequest,
  RouteSnapshot,
  RouteStepSnapshot,
  RoutesAdapter,
  RouteWaypoint,
} from "./types.ts";

export class GoogleRoutesAdapter implements RoutesAdapter {
  private readonly client: GoogleHttpClient;

  constructor(client: GoogleHttpClient) {
    this.client = client;
  }

  async computeLeg(input: ComputeLegRequest): Promise<RouteSnapshot> {
    const request = mapComputeLegRequest(input);
    const response = await this.client.postJson<GoogleComputeRoutesResponse>({
      path: "/directions/v2:computeRoutes",
      fieldMask: resolveComputeRouteFieldMask(Boolean(input.includeSteps)),
      body: request,
    });

    return mapComputeRoutesResponse(response, input.travelMode);
  }

  async computeMatrix(input: RouteMatrixRequest): Promise<RouteMatrixElement[]> {
    const request = mapComputeRouteMatrixRequest(input);
    const response = await this.client.postJsonLines<GoogleRouteMatrixResponseElement>({
      path: "/distanceMatrix/v2:computeRouteMatrix",
      fieldMask: COMPUTE_ROUTE_MATRIX_FIELD_MASK,
      body: request,
    });

    return response.map((element) => ({
      originIndex: element.originIndex,
      destinationIndex: element.destinationIndex,
      distanceMeters: element.distanceMeters,
      durationMinutes: parseDurationToMinutes(element.duration),
      status: element.status?.code && element.status.code !== 0 ? "error" : "ok",
      condition: element.condition,
    }));
  }
}

function mapComputeLegRequest(input: ComputeLegRequest): GoogleComputeRoutesRequest {
  return {
    origin: toGoogleWaypoint(input.origin),
    destination: toGoogleWaypoint(input.destination),
    travelMode: toGoogleTravelMode(input.travelMode),
    routingPreference: toGoogleRoutingPreference(input.routingPreference),
    departureTime: input.departureTime,
    arrivalTime: input.arrivalTime,
    languageCode: input.languageCode,
    regionCode: input.regionCode,
  };
}

function mapComputeRouteMatrixRequest(
  input: RouteMatrixRequest
): GoogleComputeRouteMatrixRequest {
  return {
    origins: input.origins.map((origin) => ({
      waypoint: toGoogleWaypoint(origin),
    })),
    destinations: input.destinations.map((destination) => ({
      waypoint: toGoogleWaypoint(destination),
    })),
    travelMode: toGoogleTravelMode(input.travelMode),
    routingPreference: toGoogleRoutingPreference(input.routingPreference),
    departureTime: input.departureTime,
  };
}

function mapComputeRoutesResponse(
  response: GoogleComputeRoutesResponse,
  mode: ComputeLegRequest["travelMode"]
): RouteSnapshot {
  const route = response.routes?.[0];
  if (!route) {
    throw new Error("No route returned by Google Routes API.");
  }

  return {
    provider: "google_routes",
    mode,
    distanceMeters: route.distanceMeters ?? 0,
    durationMinutes: parseDurationToMinutes(route.duration) ?? 0,
    staticDurationMinutes: parseDurationToMinutes(route.staticDuration),
    polyline: route.polyline?.encodedPolyline,
    warnings: route.warnings ?? [],
    steps: (route.legs ?? []).flatMap((leg) => mapLegSteps(leg.steps)),
  };
}

function mapLegSteps(steps?: GoogleRouteStep[]): RouteStepSnapshot[] {
  return (steps ?? []).map((step) => ({
    instruction: step.navigationInstruction?.instructions,
    travelMode: mapGoogleStepMode(step.travelMode),
    distanceMeters: step.distanceMeters,
    durationMinutes: parseDurationToMinutes(step.staticDuration),
    polyline: step.polyline?.encodedPolyline,
  }));
}

function toGoogleWaypoint(waypoint: RouteWaypoint) {
  if (waypoint.placeId) {
    return { placeId: waypoint.placeId };
  }

  if (waypoint.location) {
    return {
      location: {
        latLng: {
          latitude: waypoint.location.lat,
          longitude: waypoint.location.lng,
        },
      },
    };
  }

  if (waypoint.address) {
    return { address: waypoint.address };
  }

  throw new Error("RouteWaypoint must include placeId, location, or address.");
}

function toGoogleTravelMode(mode: ComputeLegRequest["travelMode"]): GoogleRouteTravelMode {
  switch (mode) {
    case "walk":
      return "WALK";
    case "transit":
      return "TRANSIT";
    case "drive":
    case "taxi":
      return "DRIVE";
  }
}

function toGoogleRoutingPreference(
  preference?: RouteMatrixRequest["routingPreference"]
): GoogleRoutingPreference | undefined {
  switch (preference) {
    case "traffic_aware":
      return "TRAFFIC_AWARE";
    case "traffic_unaware":
      return "TRAFFIC_UNAWARE";
    default:
      return undefined;
  }
}

function mapGoogleStepMode(
  mode?: GoogleRouteTravelMode
): ComputeLegRequest["travelMode"] | undefined {
  switch (mode) {
    case "WALK":
      return "walk";
    case "TRANSIT":
      return "transit";
    case "DRIVE":
      return "drive";
    default:
      return undefined;
  }
}

function parseDurationToMinutes(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number.parseFloat(value.replace(/s$/, ""));
  if (Number.isNaN(seconds)) {
    return undefined;
  }

  return Math.max(1, Math.round(seconds / 60));
}
