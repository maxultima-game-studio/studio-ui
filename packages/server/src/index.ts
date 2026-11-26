import cors from "cors";
import express from "express";
import path from "node:path";
import { validateGameDesign, type ProposalItem } from "@studio-ui/shared";
import {
  applyProposalItems,
  deleteEntity,
  discoverGames,
  getGamesRoot,
  loadGameDesign,
  resolveGameDir,
  saveEntity,
  saveFlags,
  saveGameConfig,
  savePitch,
  saveWorld,
  type CollectionKind,
} from "./design-store.js";
import {
  isAiConfigured,
  proposeExpandPitch,
  proposeStructure,
  reviewStoryLogic,
} from "./gemini.js";
import { getPipelineStatuses, triggerPipelineSlot } from "./pipeline-bridge.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const PORT = Number(process.env.PORT ?? 4310);

app.get("/api/health", async (_req, res) => {
  const ai = await isAiConfigured();
  res.json({
    ok: true,
    gamesRoot: getGamesRoot(),
    ai,
  });
});

app.get("/api/games", async (_req, res) => {
  try {
    const games = await discoverGames();
    res.json({ games, gamesRoot: getGamesRoot() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/games/:slug/design", async (req, res) => {
  try {
    const bundle = await loadGameDesign(req.params.slug);
    const issues = validateGameDesign(bundle);
    const pipeline = await getPipelineStatuses(req.params.slug, bundle);
    res.json({ bundle, issues, pipeline });
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

app.put("/api/games/:slug/game", async (req, res) => {
  try {
    const saved = await saveGameConfig(req.params.slug, req.body);
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.put("/api/games/:slug/pitch", async (req, res) => {
  try {
    const pitch = typeof req.body?.pitch === "string" ? req.body.pitch : "";
    await savePitch(req.params.slug, pitch);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.put("/api/games/:slug/world", async (req, res) => {
  try {
    const saved = await saveWorld(req.params.slug, req.body);
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.put("/api/games/:slug/flags", async (req, res) => {
  try {
    const saved = await saveFlags(req.params.slug, req.body);
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

const VALID_KINDS = new Set<CollectionKind>([
  "characters",
  "items",
  "scenes",
  "puzzles",
  "dialogues",
]);

app.put("/api/games/:slug/entities/:kind", async (req, res) => {
  try {
    const kind = req.params.kind as CollectionKind;
    if (!VALID_KINDS.has(kind)) {
      res.status(400).json({ error: `Invalid entity kind: ${kind}` });
      return;
    }
    const saved = await saveEntity(req.params.slug, kind, req.body);
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.delete("/api/games/:slug/entities/:kind/:id", async (req, res) => {
  try {
    const kind = req.params.kind as CollectionKind;
    if (!VALID_KINDS.has(kind)) {
      res.status(400).json({ error: `Invalid entity kind: ${kind}` });
      return;
    }
    await deleteEntity(req.params.slug, kind, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/games/:slug/ai/expand-pitch", async (req, res) => {
  try {
    const bundle = await loadGameDesign(req.params.slug);
    const proposal = await proposeExpandPitch(bundle);
    res.json(proposal);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/games/:slug/ai/generate-structure", async (req, res) => {
  try {
    const bundle = await loadGameDesign(req.params.slug);
    const proposal = await proposeStructure(bundle);
    res.json(proposal);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/games/:slug/ai/apply-proposal", async (req, res) => {
  try {
    const items = (req.body?.items ?? []) as ProposalItem[];
    const result = await applyProposalItems(req.params.slug, items);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/games/:slug/ai/review-logic", async (req, res) => {
  try {
    const bundle = await loadGameDesign(req.params.slug);
    const review = await reviewStoryLogic(bundle);
    res.json(review);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/games/:slug/pipeline/trigger", async (req, res) => {
  try {
    const slotId = String(req.body?.slot_id ?? "");
    const result = await triggerPipelineSlot(req.params.slug, slotId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/games/:slug/pipeline/asset", async (req, res) => {
  try {
    const relPath = String(req.query.path ?? "");
    const gameDir = await resolveGameDir(req.params.slug);
    const fullPath = path.resolve(gameDir, relPath);
    if (!fullPath.startsWith(gameDir)) {
      res.status(403).json({ error: "Forbidden path" });
      return;
    }
    res.sendFile(fullPath);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(
    `[studio-ui/server] listening on http://localhost:${PORT} (gamesRoot=${getGamesRoot()})`
  );
});
