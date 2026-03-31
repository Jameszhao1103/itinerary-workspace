export const COMPUTE_ROUTE_FIELD_MASK = [
  "routes.distanceMeters",
  "routes.duration",
  "routes.staticDuration",
  "routes.polyline.encodedPolyline",
  "routes.warnings",
] as const;

export const COMPUTE_ROUTE_WITH_STEPS_FIELD_MASK = [
  ...COMPUTE_ROUTE_FIELD_MASK,
  "routes.legs.distanceMeters",
  "routes.legs.duration",
  "routes.legs.staticDuration",
  "routes.legs.polyline.encodedPolyline",
  "routes.legs.steps.distanceMeters",
  "routes.legs.steps.staticDuration",
  "routes.legs.steps.polyline.encodedPolyline",
  "routes.legs.steps.travelMode",
  "routes.legs.steps.navigationInstruction.instructions",
] as const;

export const COMPUTE_ROUTE_MATRIX_FIELD_MASK = [
  "originIndex",
  "destinationIndex",
  "distanceMeters",
  "duration",
  "status",
  "condition",
] as const;

export function resolveComputeRouteFieldMask(includeSteps: boolean): readonly string[] {
  return includeSteps ? COMPUTE_ROUTE_WITH_STEPS_FIELD_MASK : COMPUTE_ROUTE_FIELD_MASK;
}
