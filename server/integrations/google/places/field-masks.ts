export const PLACE_SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
] as const;

export const PLACE_SEARCH_WITH_HOURS_FIELD_MASK = [
  ...PLACE_SEARCH_FIELD_MASK,
  "places.currentOpeningHours",
  "places.regularOpeningHours",
] as const;

export const PLACE_DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "types",
  "googleMapsUri",
  "rating",
  "userRatingCount",
  "priceLevel",
  "currentOpeningHours",
  "regularOpeningHours",
] as const;

export function resolvePlaceSearchFieldMask(includeHours: boolean): readonly string[] {
  return includeHours ? PLACE_SEARCH_WITH_HOURS_FIELD_MASK : PLACE_SEARCH_FIELD_MASK;
}
