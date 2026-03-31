import { compareIso } from "./time.ts";
import type { Itinerary, PlannerCommand, PlannerPreviewDiff } from "./types.ts";

export function buildPreviewDiff(
  before: Itinerary,
  after: Itinerary,
  commands: PlannerCommand[]
): PlannerPreviewDiff {
  const changedItemIds = collectChangedItemIds(before, after);
  const changedRouteIds = collectChangedRouteIds(before, after);
  const changedPlaceIds = collectChangedPlaceIds(before, after);
  const changedDays = after.days
    .filter((day) => {
      const previous = before.days.find((candidate) => candidate.date === day.date);
      return JSON.stringify(previous?.items ?? []) !== JSON.stringify(day.items);
    })
    .map((day) => day.date);

  return {
    summary: summarizeCommands(commands, changedItemIds.length, changedRouteIds.length),
    patch: {
      changed_days: changedDays,
      changed_item_ids: changedItemIds,
      changed_route_ids: changedRouteIds,
      changed_place_ids: changedPlaceIds,
    },
  };
}

export function diffConflictIds(before: Itinerary, after: Itinerary): {
  resolved: string[];
  introduced: string[];
} {
  const beforeIds = new Set(before.conflicts.map((conflict) => conflict.id));
  const afterIds = new Set(after.conflicts.map((conflict) => conflict.id));

  return {
    resolved: [...beforeIds].filter((id) => !afterIds.has(id)),
    introduced: [...afterIds].filter((id) => !beforeIds.has(id)),
  };
}

function collectChangedItemIds(before: Itinerary, after: Itinerary): string[] {
  const beforeItems = new Map(before.days.flatMap((day) => day.items).map((item) => [item.id, item]));
  const afterItems = after.days.flatMap((day) => day.items);

  return afterItems
    .filter((item) => JSON.stringify(beforeItems.get(item.id)) !== JSON.stringify(item))
    .sort((left, right) => compareIso(left.start_at, right.start_at))
    .map((item) => item.id);
}

function collectChangedRouteIds(before: Itinerary, after: Itinerary): string[] {
  const beforeRoutes = new Map(before.routes.map((route) => [route.route_id, route]));
  return after.routes
    .filter((route) => JSON.stringify(beforeRoutes.get(route.route_id)) !== JSON.stringify(route))
    .map((route) => route.route_id);
}

function collectChangedPlaceIds(before: Itinerary, after: Itinerary): string[] {
  const beforePlaces = new Map(before.places.map((place) => [place.place_id, place]));
  return after.places
    .filter((place) => JSON.stringify(beforePlaces.get(place.place_id)) !== JSON.stringify(place))
    .map((place) => place.place_id);
}

function summarizeCommands(
  commands: PlannerCommand[],
  changedItemsCount: number,
  changedRoutesCount: number
): string {
  if (commands.length === 0) {
    return "Validated itinerary and refreshed derived schedule fields.";
  }

  const actions = commands.map((command) => command.action.replace(/_/g, " "));
  const firstAction = actions[0];
  const extra = actions.length > 1 ? ` plus ${actions.length - 1} more change(s)` : "";

  return `Executed ${firstAction}${extra}; ${changedItemsCount} item(s) and ${changedRoutesCount} route(s) changed.`;
}
