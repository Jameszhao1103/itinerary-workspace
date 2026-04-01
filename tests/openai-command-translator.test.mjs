import test from "node:test";
import assert from "node:assert/strict";
import { OpenAiCommandTranslator } from "../server/planner/openai-command-translator.ts";
import { createSampleTrip } from "../server/demo/sample-trip.ts";

test("openai command translator normalizes structured response into planner commands", async () => {
  const translator = new OpenAiCommandTranslator({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            commands: [
              {
                action: "replace_place",
                item_id: "item_dinner",
                place_query: "american restaurant downtown",
                constraints: {
                  near_place_id: "place_curate",
                  min_rating: 4.5,
                  max_price_level: 4,
                },
              },
            ],
          }),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      ),
  });

  const commands = await translator.translate({
    trip: createSampleTrip(),
    utterance: "把周六晚餐换成评分高一点的美式餐厅",
  });

  assert.equal(commands.length, 1);
  assert.equal(commands[0].action, "replace_place");
  assert.equal(commands[0].item_id, "item_dinner");
  assert.equal(commands[0].day_date, "2026-04-12");
  assert.equal(commands[0].place_query, "american restaurant downtown");
  assert.equal(commands[0].constraints?.near_place_id, "place_curate");
  assert.equal(commands[0].constraints?.min_rating, 4.5);
  assert.ok(commands[0].command_id.startsWith("cmd_"));
});

test("openai command translator uses selected day context to ground current-day meal edits", async () => {
  const translator = new OpenAiCommandTranslator({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            commands: [
              {
                action: "replace_place",
                place_query: "american restaurant asheville",
                constraints: {
                  min_rating: 4.5,
                },
              },
            ],
          }),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      ),
  });

  const commands = await translator.translate({
    trip: createSampleTrip(),
    utterance: "把当前这天的晚餐换成评分高一点的美式餐厅",
    context: {
      selected_day: "2026-04-13",
    },
  });

  assert.equal(commands.length, 1);
  assert.equal(commands[0].action, "replace_place");
  assert.equal(commands[0].item_id, "item_day2_dinner");
  assert.equal(commands[0].day_date, "2026-04-13");
  assert.equal(commands[0].place_query, "american restaurant asheville");
});
