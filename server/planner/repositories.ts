import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Itinerary, PlannerPreview } from "./types.ts";

export interface TripRepository {
  getTripById(tripId: string): Promise<Itinerary | null>;
  saveTrip(trip: Itinerary): Promise<Itinerary>;
}

export interface PreviewRepository {
  savePreview(preview: PlannerPreview): Promise<void>;
  getPreview(previewId: string): Promise<PlannerPreview | null>;
  deletePreview(previewId: string): Promise<void>;
}

export class InMemoryTripRepository implements TripRepository {
  private readonly trips = new Map<string, Itinerary>();

  constructor(seedTrips: Itinerary[] = []) {
    seedTrips.forEach((trip) => {
      this.trips.set(trip.trip_id, structuredClone(trip));
    });
  }

  async getTripById(tripId: string): Promise<Itinerary | null> {
    const trip = this.trips.get(tripId);
    return trip ? structuredClone(trip) : null;
  }

  async saveTrip(trip: Itinerary): Promise<Itinerary> {
    const copy = structuredClone(trip);
    this.trips.set(copy.trip_id, copy);
    return structuredClone(copy);
  }
}

export class InMemoryPreviewRepository implements PreviewRepository {
  private readonly previews = new Map<string, PlannerPreview>();

  async savePreview(preview: PlannerPreview): Promise<void> {
    this.previews.set(preview.previewId, structuredClone(preview));
  }

  async getPreview(previewId: string): Promise<PlannerPreview | null> {
    const preview = this.previews.get(previewId);
    return preview ? structuredClone(preview) : null;
  }

  async deletePreview(previewId: string): Promise<void> {
    this.previews.delete(previewId);
  }
}

export class FileTripRepository implements TripRepository {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  async getTripById(tripId: string): Promise<Itinerary | null> {
    const filePath = this.tripFilePath(tripId);
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as Itinerary;
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }
      throw error;
    }
  }

  async saveTrip(trip: Itinerary): Promise<Itinerary> {
    const copy = structuredClone(trip);
    const filePath = this.tripFilePath(copy.trip_id);
    await mkdir(dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(copy, null, 2)}\n`, "utf8");
    await rename(tempPath, filePath);
    return structuredClone(copy);
  }

  private tripFilePath(tripId: string): string {
    return join(this.rootDir, `${tripId}.json`);
  }
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
  );
}
