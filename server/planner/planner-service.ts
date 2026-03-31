import { executeCommands } from "./command-executor.ts";
import { buildPreviewDiff, diffConflictIds } from "./diff.ts";
import { PlannerError } from "./errors.ts";
import { createId } from "./ids.ts";
import type { PreviewRepository, TripRepository } from "./repositories.ts";
import type {
  CommandExecutionContext,
  Itinerary,
  PlannerApplyRequest,
  PlannerApplyResponse,
  PlannerDependencies,
  PlannerPreview,
  PlannerPreviewRequest,
  PlannerPreviewResponse,
  PlannerRejectPreviewRequest,
} from "./types.ts";

export class PlannerService {
  private readonly tripRepository: TripRepository;
  private readonly previewRepository: PreviewRepository;
  private readonly dependencies: PlannerDependencies;

  constructor(
    tripRepository: TripRepository,
    previewRepository: PreviewRepository,
    dependencies: PlannerDependencies
  ) {
    this.tripRepository = tripRepository;
    this.previewRepository = previewRepository;
    this.dependencies = dependencies;
  }

  async previewCommand(input: PlannerPreviewRequest): Promise<PlannerPreviewResponse> {
    const trip = await this.loadTripForMutation(input.tripId, input.baseVersion);
    const commands = await this.resolveCommands(trip, input.input);
    const working = structuredClone(trip);
    const now = this.now();
    const context: CommandExecutionContext = {
      ...this.dependencies,
      now,
    };

    await executeCommands(working, commands, context);
    working.version = trip.version + 1;

    const diff = buildPreviewDiff(trip, working, commands);
    const conflictDelta = diffConflictIds(trip, working);
    const preview: PlannerPreview = {
      previewId: createId("preview"),
      tripId: trip.trip_id,
      baseVersion: trip.version,
      resultVersion: working.version,
      commands,
      changedItemIds: diff.patch.changed_item_ids,
      warnings: working.conflicts.filter((conflict) => conflict.severity !== "info").map((conflict) => conflict.message),
      resolvedConflicts: conflictDelta.resolved,
      introducedConflicts: conflictDelta.introduced,
      diff,
      tripPreview: working,
      createdAt: now.toISOString(),
    };

    await this.previewRepository.savePreview(preview);

    return {
      preview_id: preview.previewId,
      base_version: preview.baseVersion,
      result_version: preview.resultVersion,
      commands: preview.commands,
      changed_item_ids: preview.changedItemIds,
      warnings: preview.warnings,
      resolved_conflicts: preview.resolvedConflicts,
      introduced_conflicts: preview.introducedConflicts,
      diff: preview.diff,
      trip_preview: preview.tripPreview,
    };
  }

  async applyPreview(input: PlannerApplyRequest): Promise<PlannerApplyResponse> {
    const trip = await this.loadTripForMutation(input.tripId, input.baseVersion);
    const preview = await this.previewRepository.getPreview(input.previewId);
    if (!preview || preview.tripId !== trip.trip_id) {
      throw new PlannerError("preview_not_found", `Preview not found: ${input.previewId}`);
    }

    if (preview.baseVersion !== trip.version) {
      throw new PlannerError("version_conflict", "Preview base_version is stale.");
    }

    const savedTrip = await this.tripRepository.saveTrip({
      ...preview.tripPreview,
      version: preview.resultVersion,
      change_log: [
        ...preview.tripPreview.change_log,
        {
          id: createId("change"),
          timestamp: this.now().toISOString(),
          actor: "assistant",
          summary: preview.diff.summary,
          command_ids: preview.commands.map((command) => command.command_id),
        },
      ],
    });

    await this.previewRepository.deletePreview(input.previewId);

    return {
      trip: savedTrip,
      applied_command_ids: preview.commands.map((command) => command.command_id),
    };
  }

  async rejectPreview(input: PlannerRejectPreviewRequest): Promise<void> {
    const preview = await this.previewRepository.getPreview(input.previewId);
    if (!preview || preview.tripId !== input.tripId) {
      throw new PlannerError("preview_not_found", `Preview not found: ${input.previewId}`);
    }

    await this.previewRepository.deletePreview(input.previewId);
  }

  private async resolveCommands(
    trip: Itinerary,
    input: PlannerPreviewRequest["input"]
  ) {
    if (input.commands?.length) {
      return input.commands;
    }

    if (input.utterance) {
      if (!this.dependencies.commandTranslator) {
        throw new PlannerError(
          "translator_unavailable",
          "Free-form utterance preview requires a command translator."
        );
      }

      return this.dependencies.commandTranslator.translate({
        trip,
        utterance: input.utterance,
      });
    }

    throw new PlannerError("invalid_command", "Preview requires either commands or utterance.");
  }

  private async loadTripForMutation(tripId: string, baseVersion: number): Promise<Itinerary> {
    const trip = await this.tripRepository.getTripById(tripId);
    if (!trip) {
      throw new PlannerError("trip_not_found", `Trip not found: ${tripId}`);
    }

    if (trip.version !== baseVersion) {
      throw new PlannerError("version_conflict", `Trip version ${trip.version} does not match ${baseVersion}.`);
    }

    return trip;
  }

  private now(): Date {
    return this.dependencies.clock ? this.dependencies.clock() : new Date();
  }
}
