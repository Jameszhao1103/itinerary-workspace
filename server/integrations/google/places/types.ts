import type {
  LatLng,
  OpeningHoursWindow,
  PlaceCategory,
} from "../shared/domain-types.ts";

export type PlaceSearchRequest = {
  query: string;
  locationBias?: {
    center: LatLng;
    radiusMeters: number;
  };
  includedType?: string;
  openNow?: boolean;
  minRating?: number;
  maxPriceLevel?: number;
  languageCode?: string;
  regionCode?: string;
  pageSize?: number;
  strictTypeFiltering?: boolean;
};

export type PlaceCandidate = {
  placeId: string;
  name: string;
  formattedAddress?: string;
  location: LatLng;
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  regularOpeningHours?: OpeningHoursWindow[];
  currentOpenNow?: boolean;
};

export type PlaceDetailsRequest = {
  placeId: string;
  languageCode?: string;
  regionCode?: string;
};

export type PlaceSnapshot = {
  placeId: string;
  provider: "google_places";
  name: string;
  formattedAddress?: string;
  location: LatLng;
  category: PlaceCategory;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  regularOpeningHours?: OpeningHoursWindow[];
  currentOpeningHoursText?: string[];
  types: string[];
};

export interface PlacesAdapter {
  searchByText(input: PlaceSearchRequest): Promise<PlaceCandidate[]>;
  getPlaceDetails(input: PlaceDetailsRequest): Promise<PlaceSnapshot>;
}

export type GoogleDisplayName = {
  text?: string;
  languageCode?: string;
};

export type GoogleLatLng = {
  latitude: number;
  longitude: number;
};

export type GoogleOpeningHoursPoint = {
  day?: number;
  hour?: number;
  minute?: number;
};

export type GoogleOpeningHoursPeriod = {
  open?: GoogleOpeningHoursPoint;
  close?: GoogleOpeningHoursPoint;
};

export type GoogleOpeningHours = {
  openNow?: boolean;
  periods?: GoogleOpeningHoursPeriod[];
  weekdayDescriptions?: string[];
};

export type GooglePlace = {
  id: string;
  displayName?: GoogleDisplayName;
  formattedAddress?: string;
  location?: GoogleLatLng;
  primaryType?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: GooglePriceLevel;
  regularOpeningHours?: GoogleOpeningHours;
  currentOpeningHours?: GoogleOpeningHours;
  googleMapsUri?: string;
};

export type GooglePlaceSearchResponse = {
  places?: GooglePlace[];
  nextPageToken?: string;
};

export type GooglePlaceSearchRequest = {
  textQuery: string;
  languageCode?: string;
  regionCode?: string;
  includedType?: string;
  openNow?: boolean;
  minRating?: number;
  priceLevels?: GooglePriceLevel[];
  pageSize?: number;
  strictTypeFiltering?: boolean;
  locationBias?: {
    circle: {
      center: GoogleLatLng;
      radius: number;
    };
  };
};

export type GooglePriceLevel =
  | "PRICE_LEVEL_UNSPECIFIED"
  | "PRICE_LEVEL_FREE"
  | "PRICE_LEVEL_INEXPENSIVE"
  | "PRICE_LEVEL_MODERATE"
  | "PRICE_LEVEL_EXPENSIVE"
  | "PRICE_LEVEL_VERY_EXPENSIVE";
