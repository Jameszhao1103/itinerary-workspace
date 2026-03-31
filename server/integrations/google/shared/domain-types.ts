export type LatLng = {
  lat: number;
  lng: number;
};

export type TravelMode =
  | "walk"
  | "drive"
  | "taxi"
  | "transit"
  | "flight";

export type PlaceCategory =
  | "airport"
  | "hotel"
  | "restaurant"
  | "museum"
  | "park"
  | "shopping"
  | "landmark"
  | "station"
  | "other";

export type OpeningHoursWeekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type OpeningHoursWindow = {
  weekday: OpeningHoursWeekday;
  open: string;
  close: string;
};

export const OPENING_HOURS_WEEKDAYS: OpeningHoursWeekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function formatHourMinute(hour?: number, minute?: number): string {
  const safeHour = hour ?? 0;
  const safeMinute = minute ?? 0;
  return `${String(safeHour).padStart(2, "0")}:${String(safeMinute).padStart(2, "0")}`;
}
