import assert from "node:assert/strict";
import test from "node:test";
import {
  KebabIdSchema,
  SceneSchema,
  validateGameDesign,
  type GameDesignBundle,
} from "./index.js";

function makeBaseBundle(): GameDesignBundle {
  return {
    slug: "game-test",
    game: {
      id: "test",
      title: { cs: "Test", en: "Test" },
      default_locale: "cs",
      locales: ["cs", "en"],
      genre: "point-and-click",
      style: "pixel-art",
      target_resolution: "640x360",
      target_engine: "engine-pnc-2d",
      target_pipeline: "pipeline-pnc-pixel",
      start_scene_id: "start",
    },
    pitch: "Pitch",
    story_plan: "",
    world: { locked: false, setting: {}, visual_style: "", themes: [], acts: [] },
    flags: {
      flags: [
        { id: "door-open", description: { cs: "Otevřeno", en: "Open" }, initial_value: false },
      ],
    },
    characters: [
      {
        id: "hero",
        locked: false,
        acts: [],
        name: { cs: "Hrdina", en: "Hero" },
        role: "protagonist",
        bio: {},
        voice_notes: "",
        visual_brief: "",
        asset_slots: [],
      },
    ],
    items: [
      {
        id: "key",
        locked: false,
        name: { cs: "Klíč", en: "Key" },
        description: { cs: "Starý klíč", en: "Old key" },
        visual_brief: "",
        asset_slots: [],
      },
    ],
    scenes: [
      {
        id: "start",
        locked: false,
        title: { cs: "Start", en: "Start" },
        description: {},
        visual_brief: "",
        graph_position: { x: 0, y: 0 },
        characters: ["hero"],
        exits: [],
        hotspots: [],
        asset_slots: [],
      },
    ],
    puzzles: [],
    dialogues: [],
  };
}

test("KebabIdSchema enforces lowercase kebab-case", () => {
  assert.equal(KebabIdSchema.safeParse("dock-pier-1").success, true);
  assert.equal(KebabIdSchema.safeParse("DockPier").success, false);
  assert.equal(KebabIdSchema.safeParse("p&c").success, false);
  assert.equal(KebabIdSchema.safeParse("bad_id").success, false);
});

test("SceneSchema applies defaults cleanly", () => {
  const parsed = SceneSchema.parse({
    id: "room-a",
    title: { cs: "Místnost A", en: "Room A" },
  });
  assert.equal(parsed.locked, false);
  assert.deepEqual(parsed.exits, []);
  assert.deepEqual(parsed.asset_slots, []);
});

test("validateGameDesign passes with zero issues on a clean bundle", () => {
  const issues = validateGameDesign(makeBaseBundle());
  assert.deepEqual(issues, []);
});

test("validateGameDesign detects unreachable scenes, broken refs, and missing translations", () => {
  const bundle = makeBaseBundle();
  bundle.game.title = { cs: "Test" }; // missing en
  bundle.scenes[0].characters.push("ghost");
  bundle.scenes.push({
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
  });

  const codes = new Set(validateGameDesign(bundle).map((i) => i.code));
  assert.ok(codes.has("MISSING_TRANSLATION"));
  assert.ok(codes.has("BROKEN_CHARACTER_REF"));
  assert.ok(codes.has("UNREACHABLE_SCENE"));
});

test("validateGameDesign detects dialogue dead ends, broken targets, and unknown speakers", () => {
  const bundle = makeBaseBundle();
  bundle.dialogues.push({
    id: "broken-dlg",
    locked: false,
    scene_id: "start",
    character_id: "hero",
    title: { cs: "Rozhovor", en: "Talk" },
    start_node_id: "missing-start",
    nodes: {
      line1: {
        id: "line1",
        type: "npc_line",
        position: { x: 0, y: 0 },
        speaker_id: "unknown-npc",
        text: { cs: "Ahoj" }, // missing en
      },
      choices: {
        id: "choices",
        type: "player_choice",
        position: { x: 100, y: 0 },
        choices: [
          {
            id: "c1",
            text: { cs: "Volba", en: "Choice" },
            next_node_id: "nonexistent-node",
          },
        ],
      },
    },
  });

  const codes = new Set(validateGameDesign(bundle).map((i) => i.code));
  assert.ok(codes.has("MISSING_START_NODE"));
  assert.ok(codes.has("BROKEN_CHARACTER_REF"));
  assert.ok(codes.has("DIALOGUE_DEAD_END"));
  assert.ok(codes.has("BROKEN_DIALOGUE_NODE_REF"));
  assert.ok(codes.has("MISSING_TRANSLATION"));
});

test("validateGameDesign detects broken puzzle flag and item references", () => {
  const bundle = makeBaseBundle();
  bundle.puzzles.push({
    id: "bad-puzzle",
    locked: false,
    scene_id: "unknown-scene",
    title: { cs: "Hádanka", en: "Puzzle" },
    summary: {},
    requires: [{ type: "item", ref: "missing-item" }],
    effects: [{ type: "set_flag", ref: "missing-flag", value: true }],
  });

  const codes = new Set(validateGameDesign(bundle).map((i) => i.code));
  assert.ok(codes.has("BROKEN_SCENE_REF"));
  assert.ok(codes.has("BROKEN_ITEM_REF"));
  assert.ok(codes.has("BROKEN_FLAG_REF"));
});
