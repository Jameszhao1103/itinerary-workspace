# Planner Workspace

Planner Workspace is an AI-assisted itinerary editor for travel planning.

Instead of generating a trip plan once and freezing it, this project treats a trip as a shared editable workspace:

- `Map` explains where you are going
- `Timeline` explains when things happen
- `Plan` explains the day in readable text
- `Assistant` turns natural-language requests into itinerary mutations

The core idea is that all views read from the same itinerary state. When a user edits the trip manually or asks the assistant to change it, the system recomputes routes, timing, conflicts, and view-specific derivations from that single source of truth.

## What This Project Does

Current MVP capabilities:

- Global day switcher that updates every panel together
- Interactive map with stop markers and route polylines
- Horizontal timeline for the active day
- Text plan view for the active day
- Selection panel for focused editing
- Assistant preview/apply flow for itinerary mutations
- Manual editing tools:
  - lock / unlock an item
  - reorder an item
  - move an item in time
  - replace a place
- Three-view synchronization:
  - click an item in `Map`, `Timeline`, or `Plan`
  - the same item is selected everywhere
- Route and opening-hours validation
- Real provider support:
  - Google Places + Routes
  - OpenAI command translation

## Product Shape

The current UI is organized as:

- Left: `Map`
- Right top: `Timeline`
- Right bottom: `Workspace`

The `Workspace` contains three tabs:

- `Selection`: focused item editor
- `Plan`: readable text itinerary
- `Assistant`: natural-language preview / apply workflow

This is intentionally closer to an editable planning tool than a chat-only travel assistant.

## How It Works

The system uses one itinerary object as the source of truth.

That state contains:

- trip metadata
- days and items
- places
- routes
- conflicts
- change log

From there, the app derives:

- map markers and polylines
- timeline blocks
- plan rows
- warnings and conflict badges
- assistant diffs

The planner engine is responsible for mutation and recomputation.

Typical flow:

1. User selects a day.
2. User edits directly or types a request into the assistant.
3. The planner resolves commands.
4. The engine recomputes routes, time gaps, and conflicts.
5. The UI re-renders `Map`, `Timeline`, `Plan`, and `Selection` from the same updated state.

## Runtime Modes

This repo supports two provider layers.

### 1. Mock mode

Default local mode.

Uses:

- sample trip data
- mock Places adapter
- mock Routes adapter
- rule-based translator unless OpenAI is configured

This is the fastest way to work on UI and planner logic.

### 2. Real API mode

Uses live providers:

- Google Places
- Google Routes
- OpenAI command planner

This is useful for validating the actual search, routing, and natural-language mutation behavior.

## Quick Start

### Requirements

- Node.js 20+ recommended
- No database required for the current MVP

### Install / run

This repo intentionally keeps runtime dependencies minimal.

Run locally:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

### Local test suite

```bash
npm test
```

## Environment Variables

The runtime reads workspace env from `.env.local` or shell env.

### Google

Use real Google providers:

```bash
GOOGLE_MAPS_API_KEY=...
GOOGLE_MAPS_BROWSER_API_KEY=...
PLANNER_PROVIDER=google
```

Notes:

- `GOOGLE_MAPS_BROWSER_API_KEY` is used by the browser map
- `GOOGLE_MAPS_API_KEY` is used by server-side Places / Routes calls
- if `PLANNER_PROVIDER` is omitted, the runtime can still infer `google` from the key

### OpenAI

Use the real LLM command planner:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
PLANNER_COMMAND_TRANSLATOR=openai
```

Notes:

- if `OPENAI_API_KEY` is present, the runtime can infer the OpenAI translator automatically
- if OpenAI fails, the system falls back to the rule-based translator

## Real API Validation

Smoke test Google adapters:

```bash
npm run test:google
```

This verifies:

- Google Places text search
- Google Routes route computation
- route distance / duration / polyline availability

Then run the app:

```bash
npm run dev
```

Useful live checks:

- provider pill shows `google`
- assistant provider shows `openai` when configured
- map loads live Google tiles
- assistant requests produce preview diffs against real providers

## Example Assistant Requests

The current planner can handle flows like:

- `把当前这天的晚餐换成评分高一点的美式餐厅`
- `锁定第一天的 River Arts District walk`
- `把第一天的 River Arts District walk 往后挪 30 分钟`
- `reoptimize the current day`
- `add lunch near the current route`

The important detail is that assistant requests are translated into structured planner commands before execution.

## Repository Structure

### Frontend

- `public/index.html`
- `public/app.js`
- `public/app.css`

This is the current interactive workspace UI.

### App server

- `server/app/create-server.mjs`
- `server/app/dev-server.mjs`
- `server/app/app-router.mjs`
- `server/app/create-runtime.mjs`
- `server/app/runtime-config.mjs`

This layer serves the UI and API endpoints.

### Planner engine

- `server/planner/planner-service.ts`
- `server/planner/command-executor.ts`
- `server/planner/derivations.ts`
- `server/planner/diff.ts`
- `server/planner/types.ts`

This layer owns:

- preview / apply / reject
- command execution
- route and timing recomputation
- conflicts
- view derivations

### Translators

- `server/planner/openai-command-translator.ts`
- `server/planner/rule-based-command-translator.ts`
- `server/planner/fallback-command-translator.ts`

This layer maps user utterances into structured planner commands.

### Providers

- `server/integrations/google/`
- `server/integrations/mock/`

This layer abstracts Places and Routes providers.

### Demo data

- `server/demo/sample-trip.ts`

This provides the seeded Asheville trip used for local testing.

### Tests

- `tests/`

This covers:

- app routing
- planner preview/apply flows
- translator normalization
- sample trip baseline validity

## API Shape

The main local API flows are:

- `GET /api/trips/:tripId`
- `POST /api/trips/:tripId/commands/preview`
- `POST /api/trips/:tripId/commands/apply`
- `POST /api/trips/:tripId/commands/reject`
- `GET /api/places/search`
- `POST /api/debug/reset`
- `GET /api/debug/runtime`

The most important mutation flow is preview/apply:

1. user issues a command
2. system returns a preview itinerary and diff
3. user applies or rejects the preview

## Current Limitations

This repo is still an MVP / prototype.

Important current limitations:

- persistence is in-memory, not database-backed
- there is no auth or multi-user model
- UI is not yet optimized for production polish
- planner optimization is heuristic, not a full solver
- Google and OpenAI usage still needs cost controls and stronger observability

## Design Docs

Additional design and architecture documents:

- `docs/itinerary-workspace.md`
- `docs/planner-commands.md`
- `docs/system-architecture.md`
- `docs/api-contracts.md`
- `docs/frontend-store.md`
- `docs/google-adapters.md`
- `docs/planner-engine.md`

Schemas and examples:

- `schemas/itinerary.schema.json`
- `schemas/planner-command.schema.json`
- `examples/sample-itinerary.json`

## Why This Repo Exists

The project is built around a simple product thesis:

AI should not replace the user's control over a trip plan.

Instead, AI should:

- generate a usable draft
- understand structured travel constraints
- help mutate the itinerary safely
- keep map, time, and text views consistent

That is the role of Planner Workspace.
