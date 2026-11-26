import assert from "node:assert/strict";
import test from "node:test";
import { validateGameDesign } from "./validator.js";
import type { GameDesignBundle } from "./schemas.js";

test("validateGameDesign detects unreachable scenes, broken refs, and missing translations", () => {
  const bundle: GameDesignBundle = {
    slug: "game-test",
    game: {
      id: "test",
      title: { cs: "Test" },
      default_locale: "cs",
      locales: ["cs", "en"],
      genre: "point-and-click",
      style: "pixel-art",
      target_resolution: "640x360",
      start_scene_id: "start",
    },
    pitch: "Pitch",
    world: { locked: false, setting: {}, visual_style: "", themes: [], acts: [] },
    flags: { flags: [] },
    characters: [],
    items: [],
    scenes: [
      {
        id: "start",
        locked: false,
        title: { cs: "Start", en: "Start" },
        description: {},
        visual_brief: "",
        graph_position: { x: 0, y: 0 },
        characters: ["ghost"],
        exits: [],
        hotspots: [],
        asset_slots: [],
      },
      {
        id: "island",
        locked: false,
        title: { cs: "Ostrov", en: "Island" },
        description: {},
        visual_brief: "",
        graph_position: { x: 200, y: 0 },
        characters: [],
        exits: [],
        hotspots: [],
        asset_slots: [],
      },
    ],
    puzzles: [],
    dialogues: [],
  };

  const issues = validateGameDesign(bundle);
  const codes = new Set(issues.map((i) => i.code));
  assert.ok(codes.has("MISSING_TRANSLATION"));
  assert.ok(codes.has("BROKEN_CHARACTER_REF"));
  assert.ok(codes.has("UNREACHABLE_SCENE"));
});
