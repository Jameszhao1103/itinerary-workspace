import type { LatLng, TravelMode } from "../shared/domain-types.ts";

export type RouteWaypoint = {
  placeId?: string;
  location?: LatLng;
  address?: string;
};

export type RoutingPreference = "traffic_unaware" | "traffic_aware";

export type ComputeLegRequest = {
  origin: RouteWaypoint;
  destination: RouteWaypoint;
  travelMode: Exclude<TravelMode, "flight">;
  departureTime?: string;
  arrivalTime?: string;
  languageCode?: string;
  regionCode?: string;
  includeSteps?: boolean;
  routingPreference?: RoutingPreference;
};

export type RouteStepSnapshot = {
  instruction?: string;
  travelMode?: Exclude<TravelMode, "flight">;
  distanceMeters?: number;
  durationMinutes?: number;
  polyline?: string;
};

export type RouteSnapshot = {
  provider: "google_routes";
  mode: Exclude<TravelMode, "flight">;
  distanceMeters: number;
  durationMinutes: number;
  staticDurationMinutes?: number;
  polyline?: string;
  warnings: string[];
  steps: RouteStepSnapshot[];
};

export type RouteMatrixRequest = {
  origins: RouteWaypoint[];
  destinations: RouteWaypoint[];
  travelMode: Exclude<TravelMode, "flight">;
  departureTime?: string;
  routingPreference?: RoutingPreference;
};

export type RouteMatrixElement = {
  originIndex: number;
  destinationIndex: number;
  distanceMeters?: number;
  durationMinutes?: number;
  status: "ok" | "error";
  condition?: string;
};

export interface RoutesAdapter {
  computeLeg(input: ComputeLegRequest): Promise<RouteSnapshot>;
  computeMatrix(input: RouteMatrixRequest): Promise<RouteMatrixElement[]>;
}

export type GoogleRouteTravelMode = "DRIVE" | "WALK" | "TRANSIT";

export type GoogleRoutingPreference =
  | "ROUTING_PREFERENCE_UNSPECIFIED"
  | "TRAFFIC_UNAWARE"
  | "TRAFFIC_AWARE"
  | "TRAFFIC_AWARE_OPTIMAL";

export type GoogleRouteWaypoint = {
  location?: {
    latLng: {
      latitude: number;
      longitude: number;
    };
  };
  placeId?: string;
  address?: string;
};

export type GoogleComputeRoutesRequest = {
  origin: GoogleRouteWaypoint;
  destination: GoogleRouteWaypoint;
  travelMode: GoogleRouteTravelMode;
  routingPreference?: GoogleRoutingPreference;
  departureTime?: string;
  arrivalTime?: string;
  languageCode?: string;
  regionCode?: string;
};

export type GoogleNavigationInstruction = {
  instructions?: string;
};

export type GoogleRouteStep = {
  distanceMeters?: number;
  staticDuration?: string;
  travelMode?: GoogleRouteTravelMode;
  polyline?: {
    encodedPolyline?: string;
  };
  navigationInstruction?: GoogleNavigationInstruction;
};

export type GoogleRouteLeg = {
  distanceMeters?: number;
  duration?: string;
  staticDuration?: string;
  polyline?: {
    encodedPolyline?: string;
  };
  steps?: GoogleRouteStep[];
};

export type GoogleRoute = {
  distanceMeters?: number;
  duration?: string;
  staticDuration?: string;
  warnings?: string[];
  polyline?: {
    encodedPolyline?: string;
  };
  legs?: GoogleRouteLeg[];
};

export type GoogleComputeRoutesResponse = {
  routes?: GoogleRoute[];
};

export type GoogleRouteMatrixOrigin = {
  waypoint: GoogleRouteWaypoint;
};

export type GoogleRouteMatrixDestination = {
  waypoint: GoogleRouteWaypoint;
};

export type GoogleComputeRouteMatrixRequest = {
  origins: GoogleRouteMatrixOrigin[];
  destinations: GoogleRouteMatrixDestination[];
  travelMode: GoogleRouteTravelMode;
  routingPreference?: GoogleRoutingPreference;
  departureTime?: string;
};

export type GoogleRouteMatrixStatus = {
  code?: number;
  message?: string;
};

export type GoogleRouteMatrixResponseElement = {
  originIndex: number;
  destinationIndex: number;
  distanceMeters?: number;
  duration?: string;
  condition?: string;
  status?: GoogleRouteMatrixStatus;
};
