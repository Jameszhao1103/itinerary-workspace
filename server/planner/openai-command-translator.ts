import { PlannerError } from "./errors.ts";
import { createId } from "./ids.ts";
import type {
  Itinerary,
  PlannerCommand,
  PlannerCommandAction,
  PlannerCommandTranslator,
} from "./types.ts";

const COMMAND_ACTIONS: PlannerCommandAction[] = [
  "lock_item",
  "unlock_item",
  "move_item",
  "reorder_item",
  "replace_place",
  "insert_item",
  "delete_item",
  "set_transport_mode",
  "optimize_day",
  "relax_day",
  "compress_day",
  "fill_meal",
  "resolve_conflict",
];

const COMMANDS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["commands"],
  properties: {
    commands: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action"],
        properties: {
          action: {
            type: "string",
            enum: COMMAND_ACTIONS,
          },
          reason: { type: "string" },
          day_date: { type: "string" },
          item_id: { type: "string" },
          target_item_id: { type: "string" },
          place_query: { type: "string" },
          place_id: { type: "string" },
          new_start_at: { type: "string" },
          new_end_at: { type: "string" },
          mode: {
            type: "string",
            enum: ["walk", "drive", "taxi", "transit", "flight"],
          },
          kind: {
            type: "string",
            enum: ["activity", "meal", "buffer", "free_time", "transit"],
          },
          constraints: {
            type: "object",
            additionalProperties: false,
            properties: {
              near_place_id: { type: "string" },
              min_rating: { type: "number" },
              max_price_level: { type: "number" },
              respect_locks: { type: "boolean" },
              max_walk_minutes: { type: "number" },
            },
          },
          payload: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = [
  "You are a planner command compiler for a travel itinerary workspace.",
  "Convert the user request into one or more planner commands.",
  "Only use item ids, place ids, and day dates that appear in the itinerary context.",
  "Prefer the smallest command set that preserves the user's intent.",
  "Use reorder_item for sequence changes. Set payload.position to before or after and target_item_id to the anchor item.",
  "Use move_item only for explicit time changes. Keep ISO timestamps with timezone offsets from the itinerary.",
  "Use replace_place when the user wants a different venue. place_query should be a short search query, not a sentence.",
  "Use lock_item and unlock_item for locking changes.",
  "Use fill_meal to add a meal, optimize_day/relax_day/compress_day for day-level changes, and set_transport_mode for route mode changes.",
  "Do not invent unsupported actions. Do not explain your reasoning. Respond with JSON only.",
].join(" ");

export type OpenAiCommandTranslatorConfig = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export class OpenAiCommandTranslator implements PlannerCommandTranslator {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenAiCommandTranslatorConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? "gpt-4.1-mini";
    this.baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/u, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async translate(input: { trip: Itinerary; utterance: string }): Promise<PlannerCommand[]> {
    const utterance = input.utterance.trim();
    if (!utterance) {
      throw new PlannerError("invalid_command", "LLM translator requires a non-empty utterance.");
    }

    const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: SYSTEM_PROMPT }],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildUserPrompt(input.trip, utterance),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "planner_commands",
            schema: COMMANDS_SCHEMA,
            strict: true,
          },
        },
      }),
    }).catch((error) => {
      throw new PlannerError("translator_unavailable", "OpenAI command planner request failed.", {
        cause: error instanceof Error ? error.message : String(error),
      });
    });

    if (!response.ok) {
      const details = await safeReadText(response);
      throw new PlannerError("translator_unavailable", "OpenAI command planner returned an error.", {
        status: response.status,
        details,
      });
    }

    const payload = await response.json();
    const parsed = extractStructuredPayload(payload);
    return normalizePlannerCommands(parsed?.commands, input.trip, utterance);
  }
}

function buildUserPrompt(trip: Itinerary, utterance: string): string {
  return [
    `User request: ${utterance}`,
    "",
    "Trip context:",
    JSON.stringify(
      {
        trip_id: trip.trip_id,
        timezone: trip.timezone,
        preferences: trip.preferences,
        days: trip.days.map((day) => ({
          date: day.date,
          label: day.label,
          items: day.items.map((item) => ({
            id: item.id,
            kind: item.kind,
            title: item.title,
            start_at: item.start_at,
            end_at: item.end_at,
            locked: item.locked,
            category: item.category,
            place_id: item.place_id,
          })),
        })),
        places: trip.places.map((place) => ({
          place_id: place.place_id,
          name: place.name,
          category: place.category,
          rating: place.rating,
          price_level: place.price_level,
        })),
      },
      null,
      2
    ),
  ].join("\n");
}

function extractStructuredPayload(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object") {
    const candidate = payload as {
      output_parsed?: unknown;
      output_text?: unknown;
      output?: Array<{
        content?: Array<{
          type?: string;
          text?: string;
          json?: unknown;
        }>;
      }>;
    };

    if (candidate.output_parsed && typeof candidate.output_parsed === "object") {
      return candidate.output_parsed as Record<string, unknown>;
    }

    if (typeof candidate.output_text === "string" && candidate.output_text.trim()) {
      return parseJsonPayload(candidate.output_text);
    }

    if (Array.isArray(candidate.output)) {
      for (const block of candidate.output) {
        for (const content of block.content ?? []) {
          if (content?.json && typeof content.json === "object") {
            return content.json as Record<string, unknown>;
          }

          if (typeof content?.text === "string" && content.text.trim()) {
            return parseJsonPayload(content.text);
          }
        }
      }
    }
  }

  throw new PlannerError("translator_unavailable", "OpenAI command planner returned no structured payload.");
}

function parseJsonPayload(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Parsed payload was not an object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new PlannerError("translator_unavailable", "OpenAI command planner returned invalid JSON.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

function normalizePlannerCommands(
  value: unknown,
  trip: Itinerary,
  utterance: string
): PlannerCommand[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new PlannerError("invalid_command", "LLM planner did not produce any commands.");
  }

  return value.map((rawCommand, index) => normalizeCommand(rawCommand, trip, utterance, index));
}

function normalizeCommand(
  rawCommand: unknown,
  trip: Itinerary,
  utterance: string,
  index: number
): PlannerCommand {
  if (!rawCommand || typeof rawCommand !== "object") {
    throw new PlannerError("invalid_command", `Planner command ${index + 1} is not an object.`);
  }

  const command = rawCommand as Record<string, unknown>;
  const action = command.action;
  if (typeof action !== "string" || !COMMAND_ACTIONS.includes(action as PlannerCommandAction)) {
    throw new PlannerError("invalid_command", `Planner command ${index + 1} has an unsupported action.`);
  }

  const itemId = asOptionalString(command.item_id);
  const targetItemId = asOptionalString(command.target_item_id);
  const dayDate = inferDayDate(trip, asOptionalString(command.day_date), itemId, targetItemId);
  const normalized: PlannerCommand = {
    command_id: createId("cmd"),
    action: action as PlannerCommandAction,
    reason: asOptionalString(command.reason) ?? utterance,
    day_date: dayDate,
    item_id: itemId,
    target_item_id: targetItemId,
    place_query: asOptionalString(command.place_query),
    place_id: asOptionalString(command.place_id),
    new_start_at: asOptionalString(command.new_start_at),
    new_end_at: asOptionalString(command.new_end_at),
    mode: asTravelMode(command.mode),
    kind: asKind(command.kind),
    constraints: normalizeConstraints(command.constraints),
    payload: normalizePayload(command.payload),
  };

  validateNormalizedCommand(normalized, trip);
  return normalized;
}

function inferDayDate(
  trip: Itinerary,
  rawDayDate: string | undefined,
  itemId?: string,
  targetItemId?: string
): string | undefined {
  if (rawDayDate) {
    const day = trip.days.find((candidate) => candidate.date === rawDayDate);
    if (!day) {
      throw new PlannerError("invalid_command", `Planner command references unknown day ${rawDayDate}.`);
    }
    return rawDayDate;
  }

  const inferredItemId = itemId ?? targetItemId;
  if (!inferredItemId) {
    return undefined;
  }

  for (const day of trip.days) {
    if (day.items.some((item) => item.id === inferredItemId)) {
      return day.date;
    }
  }

  throw new PlannerError("invalid_command", `Planner command references unknown item ${inferredItemId}.`);
}

function validateNormalizedCommand(command: PlannerCommand, trip: Itinerary): void {
  const itemIds = new Set(trip.days.flatMap((day) => day.items.map((item) => item.id)));
  const placeIds = new Set(trip.places.map((place) => place.place_id));

  if (command.item_id && !itemIds.has(command.item_id)) {
    throw new PlannerError("invalid_command", `Planner command references unknown item ${command.item_id}.`);
  }

  if (command.target_item_id && !itemIds.has(command.target_item_id)) {
    throw new PlannerError("invalid_command", `Planner command references unknown target item ${command.target_item_id}.`);
  }

  if (command.place_id && !placeIds.has(command.place_id)) {
    throw new PlannerError("invalid_command", `Planner command references unknown place ${command.place_id}.`);
  }

  if (command.action === "move_item" && !command.item_id) {
    throw new PlannerError("invalid_command", "move_item requires item_id.");
  }

  if (command.action === "reorder_item") {
    const position = typeof command.payload?.position === "string" ? command.payload.position : "";
    if (!command.item_id || !command.target_item_id || !["before", "after"].includes(position)) {
      throw new PlannerError(
        "invalid_command",
        "reorder_item requires item_id, target_item_id, and payload.position of before or after."
      );
    }
  }

  if (command.action === "replace_place" && !command.item_id) {
    throw new PlannerError("invalid_command", "replace_place requires item_id.");
  }

  if (command.action === "lock_item" || command.action === "unlock_item") {
    if (!command.item_id) {
      throw new PlannerError("invalid_command", `${command.action} requires item_id.`);
    }
  }
}

function normalizeConstraints(value: unknown): PlannerCommand["constraints"] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const input = value as Record<string, unknown>;
  const constraints: NonNullable<PlannerCommand["constraints"]> = {};
  const nearPlaceId = asOptionalString(input.near_place_id);
  const minRating = asOptionalNumber(input.min_rating);
  const maxPriceLevel = asOptionalNumber(input.max_price_level);
  const respectLocks = asOptionalBoolean(input.respect_locks);
  const maxWalkMinutes = asOptionalNumber(input.max_walk_minutes);

  if (nearPlaceId) constraints.near_place_id = nearPlaceId;
  if (minRating !== undefined) constraints.min_rating = minRating;
  if (maxPriceLevel !== undefined) constraints.max_price_level = maxPriceLevel;
  if (respectLocks !== undefined) constraints.respect_locks = respectLocks;
  if (maxWalkMinutes !== undefined) constraints.max_walk_minutes = maxWalkMinutes;

  return Object.keys(constraints).length ? constraints : undefined;
}

function normalizePayload(value: unknown): PlannerCommand["payload"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asTravelMode(value: unknown): PlannerCommand["mode"] | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return ["walk", "drive", "taxi", "transit", "flight"].includes(value)
    ? (value as PlannerCommand["mode"])
    : undefined;
}

function asKind(value: unknown): PlannerCommand["kind"] | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return ["activity", "meal", "buffer", "free_time", "transit"].includes(value)
    ? (value as PlannerCommand["kind"])
    : undefined;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (_error) {
    return "";
  }
}
