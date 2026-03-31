import type {
  PlaceCandidate,
  PlaceDetailsRequest,
  PlaceSearchRequest,
  PlaceSnapshot,
  PlacesAdapter,
} from "../google/places/types.ts";
import type { ItineraryPlace } from "../../planner/types.ts";

export class MockPlacesAdapter implements PlacesAdapter {
  private readonly placesById: Map<string, ItineraryPlace>;

  constructor(places: ItineraryPlace[]) {
    this.placesById = new Map(places.map((place) => [place.place_id, place]));
  }

  async searchByText(input: PlaceSearchRequest): Promise<PlaceCandidate[]> {
    const tokens = tokenize(input.query);
    const results = [...this.placesById.values()]
      .filter((place) => matchesType(place, input.includedType))
      .filter((place) => (input.minRating ? (place.rating ?? 0) >= input.minRating : true))
      .filter((place) =>
        input.maxPriceLevel !== undefined ? (place.price_level ?? input.maxPriceLevel) <= input.maxPriceLevel : true
      )
      .filter((place) => withinLocationBias(place, input))
      .map((place) => ({
        place,
        score: scorePlace(place, tokens),
      }))
      .sort((left, right) => right.score - left.score || (right.place.rating ?? 0) - (left.place.rating ?? 0))
      .filter((entry) => entry.score > 0 || tokens.length === 0)
      .slice(0, input.pageSize ?? 5)
      .map(({ place }) => toCandidate(place));

    return results;
  }

  async getPlaceDetails(input: PlaceDetailsRequest): Promise<PlaceSnapshot> {
    const place = this.placesById.get(input.placeId);
    if (!place) {
      throw new Error(`Mock place not found: ${input.placeId}`);
    }

    return toSnapshot(place);
  }
}

function toCandidate(place: ItineraryPlace): PlaceCandidate {
  return {
    placeId: place.place_id,
    name: place.name,
    formattedAddress: place.address,
    location: { lat: place.lat, lng: place.lng },
    primaryType: place.category,
    rating: place.rating,
    userRatingCount: place.rating ? Math.round(place.rating * 120) : undefined,
    priceLevel: place.price_level,
    regularOpeningHours: place.opening_hours,
    currentOpenNow: undefined,
  };
}

function toSnapshot(place: ItineraryPlace): PlaceSnapshot {
  return {
    placeId: place.place_id,
    provider: "google_places",
    name: place.name,
    formattedAddress: place.address,
    location: { lat: place.lat, lng: place.lng },
    category: place.category,
    googleMapsUri: place.maps_uri,
    rating: place.rating,
    userRatingCount: place.rating ? Math.round(place.rating * 120) : undefined,
    priceLevel: place.price_level,
    regularOpeningHours: place.opening_hours,
    currentOpeningHoursText: place.opening_hours?.map((window) => `${window.weekday} ${window.open}-${window.close}`),
    types: [place.category],
  };
}

function matchesType(place: ItineraryPlace, includedType?: string): boolean {
  if (!includedType) {
    return true;
  }

  if (includedType === "restaurant") {
    return place.category === "restaurant";
  }

  if (includedType === "museum") {
    return place.category === "museum" || place.category === "landmark";
  }

  return place.category === includedType;
}

function withinLocationBias(place: ItineraryPlace, input: PlaceSearchRequest): boolean {
  const bias = input.locationBias;
  if (!bias) {
    return true;
  }

  return haversineMeters(place.lat, place.lng, bias.center.lat, bias.center.lng) <= bias.radiusMeters;
}

function scorePlace(place: ItineraryPlace, tokens: string[]): number {
  if (tokens.length === 0) {
    return 1;
  }

  const haystack = tokenize([place.name, place.address, place.category].filter(Boolean).join(" "));
  let score = 0;

  tokens.forEach((token) => {
    if (haystack.includes(token)) {
      score += 4;
    }
    if (token === "american" && place.name.match(/smokehouse|tavern|bistro/i)) {
      score += 3;
    }
    if (token === "downtown" && place.address?.match(/Asheville/i)) {
      score += 2;
    }
    if (token === "美式" && place.name.match(/smokehouse|tavern|bistro/i)) {
      score += 3;
    }
  });

  return score;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
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
