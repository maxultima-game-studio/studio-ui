import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateGameDesign } from "@studio-ui/shared";
import {
  applyProposalItems,
  discoverGames,
  loadGameDesign,
  saveEntity,
  saveGameConfig,
  savePitch,
} from "./design-store.js";
import { getPipelineStatuses, triggerPipelineSlot } from "./pipeline-bridge.js";

test("design-store round-trip read/write and locked entity protection", async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "studio-ui-test-"));
  const gameDir = path.join(tmpRoot, "game-sandbox");
  await fs.mkdir(path.join(gameDir, "design"), { recursive: true });

  const prevRoot = process.env.STUDIO_GAMES_ROOT;
  process.env.STUDIO_GAMES_ROOT = tmpRoot;

  try {
    const games = await discoverGames();
    assert.equal(games.length, 1);
    assert.equal(games[0].slug, "game-sandbox");

    await saveGameConfig("game-sandbox", {
      id: "sandbox",
      title: { cs: "Pískoviště", en: "Sandbox" },
      default_locale: "cs",
      locales: ["cs", "en"],
      genre: "point-and-click",
      style: "pixel-art",
      target_resolution: "640x360",
      target_engine: "engine-pnc-2d",
      target_pipeline: "pipeline-pnc-pixel",
      start_scene_id: "locked-room",
    });
    await savePitch("game-sandbox", "Test pitch content");

    await saveEntity("game-sandbox", "scenes", {
      id: "locked-room",
      locked: true,
      title: { cs: "Zamčená místnost", en: "Locked Room" },
      description: { cs: "Původní", en: "Original" },
      visual_brief: "Keep me intact",
      graph_position: { x: 10, y: 20 },
      characters: [],
      exits: [],
      hotspots: [],
      asset_slots: [
        { slot_id: "locked-room-bg", kind: "background", brief: "BG" },
      ],
    });

    // Apply AI proposal attempting to overwrite locked-room and create new-room
    const applyRes = await applyProposalItems("game-sandbox", [
      {
        key: "scene:locked-room",
        entity_type: "scene",
        entity_id: "locked-room",
        action: "update",
        locked: false,
        summary: "Try overwrite",
        data: {
          id: "locked-room",
          locked: false,
          title: { cs: "Přepsáno AI", en: "Overwritten by AI" },
        },
      },
      {
        key: "scene:new-room",
        entity_type: "scene",
        entity_id: "new-room",
        action: "create",
        locked: false,
        summary: "Create new room",
        data: {
          id: "new-room",
          locked: false,
          title: { cs: "Nová místnost", en: "New Room" },
        },
      },
    ]);

    assert.deepEqual(applyRes.skippedLocked, ["scene:locked-room"]);
    assert.deepEqual(applyRes.applied, ["scene:new-room"]);

    const loaded = await loadGameDesign("game-sandbox");
    const lockedRoom = loaded.scenes.find((s) => s.id === "locked-room");
    assert.equal(lockedRoom?.title.cs, "Zamčená místnost");
    assert.equal(loaded.scenes.length, 2);
    assert.equal(loaded.pitch, "Test pitch content");

    // Pipeline Bridge reads specs/*.spec.json
    await fs.mkdir(path.join(gameDir, "specs"), { recursive: true });
    await fs.writeFile(
      path.join(gameDir, "specs", "locked-room-bg.spec.json"),
      JSON.stringify({
        status: "approved",
        preview_path: "assets/locked-room-bg.png",
        notes: "Approved by artist",
      })
    );
    const statuses = await getPipelineStatuses("game-sandbox", loaded);
    assert.equal(statuses["locked-room-bg"].status, "approved");
    assert.ok(statuses["locked-room-bg"].preview_url?.includes("locked-room-bg.png"));

    const triggerRes = await triggerPipelineSlot("game-sandbox", "locked-room-bg");
    assert.equal(triggerRes.status, "not_configured");
  } finally {
    if (prevRoot === undefined) delete process.env.STUDIO_GAMES_ROOT;
    else process.env.STUDIO_GAMES_ROOT = prevRoot;
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});

test("reference game-first-demo/design/ validates cleanly when present", async () => {
  const games = await discoverGames();
  const demo = games.find((g) => g.slug === "game-first-demo" && g.hasDesign);
  if (!demo) return; // Skip cleanly in isolated CI without sibling repo

  const bundle = await loadGameDesign("game-first-demo");
  const issues = validateGameDesign(bundle);
  assert.deepEqual(issues, []);
  assert.ok(bundle.scenes.length >= 2);
  assert.ok(bundle.dialogues.length >= 1);
});
