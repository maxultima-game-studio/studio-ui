import cors from "cors";
import express from "express";
import path from "node:path";
import { validateGameDesign, type ProposalItem } from "@studio-ui/shared";
import {
  clearAiLogs,
  deleteProvider,
  fetchModelsForProvider,
  getAiLogs,
  getAllProviders,
  getPublicProviders,
  listAllModels,
  upsertProvider,
  type AiProviderKind,
} from "./ai-providers.js";
import {
  applyProposalItems,
  deleteEntity,
  discoverGames,
  getGamesRoot,
  loadGameDesign,
  resetAndApplyPhaseProposal,
  resolveGameDir,
  saveEntity,
  saveFlags,
  saveGameConfig,
  savePitch,
  saveStoryPlan,
  saveWorld,
  type CollectionKind,
} from "./design-store.js";
import {
  expandPitchToStory,
  generateActEntities,
  isAiConfigured,
  planStoryActs,
  proposeStructure,
  refinePitch,
  refineSingleAct,
  refineSingleEntity,
  reviewStoryLogic,
} from "./gemini.js";
import { getPipelineStatuses, triggerPipelineSlot } from "./pipeline-bridge.js";
import { loadUiPrefs, saveUiPrefs } from "./ui-prefs.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const PORT = Number(process.env.PORT ?? 4310);

interface AiJob {
  id: string;
  status: "running" | "done" | "error";
  createdAt: number;
  result?: unknown;
  error?: string;
}

const aiJobs = new Map<string, AiJob>();

function startAiJob(fn: () => Promise<unknown>): string {
  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const job: AiJob = { id, status: "running", createdAt: Date.now() };
  aiJobs.set(id, job);

  // Prune jobs older than 30 min
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [k, v] of aiJobs.entries()) {
    if (v.createdAt < cutoff) aiJobs.delete(k);
  }

  fn()
    .then((result) => {
      job.status = "done";
      job.result = result;
    })
    .catch((err) => {
      job.status = "error";
      job.error = (err as Error).message;
    });

  return id;
}

app.get("/api/health", async (_req, res) => {
  const ai = await isAiConfigured();
  res.json({
    ok: true,
    gamesRoot: getGamesRoot(),
    ai,
  });
});

// AI Providers Management
app.get("/api/ai/providers", async (_req, res) => {
  try {
    const [providers, models] = await Promise.all([
      getPublicProviders(),
      listAllModels(),
    ]);
    res.json({ providers, models });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/ai/providers", async (req, res) => {
  try {
    const id = String(req.body?.id ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-");
    const name = String(req.body?.name ?? "").trim();
    const kind = req.body?.kind as AiProviderKind;
    const baseUrl = String(req.body?.baseUrl ?? "").trim();
    if (!id || !name || !baseUrl || !["gemini", "opencode", "openai-compatible"].includes(kind)) {
      res.status(400).json({ error: "Invalid provider fields (id, name, kind, baseUrl required)" });
      return;
    }
    const saved = await upsertProvider({
      id,
      name,
      kind,
      baseUrl,
      apiKey: typeof req.body?.apiKey === "string" ? req.body.apiKey : undefined,
      defaultModel:
        typeof req.body?.defaultModel === "string" ? req.body.defaultModel : undefined,
    });
    const models = await listAllModels();
    res.json({ provider: saved, models });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.delete("/api/ai/providers/:id", async (req, res) => {
  try {
    await deleteProvider(req.params.id);
    const models = await listAllModels();
    res.json({ ok: true, models });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/ai/providers/:id/models", async (req, res) => {
  try {
    const all = await getAllProviders();
    const provider = all.find((p) => p.id === req.params.id);
    if (!provider) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }
    const models = await fetchModelsForProvider(provider);
    res.json({ models });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/ai/logs", (_req, res) => {
  res.json({ logs: getAiLogs() });
});

app.delete("/api/ai/logs", (_req, res) => {
  clearAiLogs();
  res.json({ ok: true });
});

app.get("/api/ui/prefs", async (_req, res) => {
  try {
    const prefs = await loadUiPrefs();
    res.json({ prefs });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put("/api/ui/prefs", async (req, res) => {
  try {
    const prefs = await saveUiPrefs(req.body ?? {});
    res.json({ prefs });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.get("/api/ai/jobs/:id", (req, res) => {
  const job = aiJobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: "AI job not found" });
    return;
  }
  res.json(job);
});

app.post("/api/games/:slug/ai/jobs", (req, res) => {
  const slug = req.params.slug;
  const kind = String(req.body?.kind ?? "");
  const payload = (req.body?.payload ?? {}) as Record<string, unknown>;

  const jobId = startAiJob(async () => {
    const bundle = await loadGameDesign(slug);
    const target = {
      providerId:
        typeof payload.providerId === "string" ? payload.providerId : undefined,
      model: typeof payload.model === "string" ? payload.model : undefined,
    };

    switch (kind) {
      case "refine-pitch":
        return refinePitch(bundle, {
          currentPitch: String(payload.currentPitch ?? bundle.pitch),
          instruction: String(payload.instruction ?? ""),
          mode: payload.mode === "generate" ? "generate" : "refine",
          locale: String(payload.locale ?? bundle.game.default_locale),
          ...target,
        });
      case "plan-story": {
        const res = await planStoryActs(bundle, {
          currentPitch: String(payload.currentPitch ?? bundle.pitch),
          currentPlan: String(payload.currentPlan ?? bundle.story_plan),
          message: String(payload.message ?? ""),
          history: Array.isArray(payload.history)
            ? (payload.history as Array<{ role: "user" | "assistant"; text: string }>)
            : [],
          locale: String(payload.locale ?? bundle.game.default_locale),
          ...target,
        });
        await saveStoryPlan(slug, res.storyPlan);
        return res;
      }
      case "expand-story": {
        const storyPlan =
          typeof payload.storyPlan === "string"
            ? payload.storyPlan
            : bundle.story_plan;
        if (typeof payload.storyPlan === "string") {
          await saveStoryPlan(slug, payload.storyPlan);
        }
        const res = await expandPitchToStory(bundle, {
          ...target,
          storyPlan,
        });
        const applied = await resetAndApplyPhaseProposal(
          slug,
          ["characters", "items", "scenes", "puzzles", "dialogues"],
          true,
          [
            {
              key: "world:world",
              entity_type: "world",
              entity_id: "world",
              action: "update",
              locked: bundle.world.locked,
              summary: res.summary,
              data: res.world,
            },
          ]
        );
        return { model: res.model, summary: res.summary, ...applied };
      }
      case "refine-act": {
        const actId = String(payload.actId ?? "");
        const instruction = String(payload.instruction ?? "");
        const res = await refineSingleAct(bundle, {
          actId,
          instruction,
          ...target,
        });
        const nextActs = bundle.world.acts.map((a) =>
          a.id === actId ? res.act : a
        );
        await saveWorld(slug, { ...bundle.world, acts: nextActs });
        return res;
      }
      case "generate-act-entities": {
        const actId = String(payload.actId ?? "");
        const proposal = await generateActEntities(bundle, {
          actId,
          ...target,
        });
        const applied = await applyProposalItems(slug, proposal.items);
        return { proposal, ...applied };
      }
      case "refine-entity": {
        const entityKind = payload.entityKind as
          | "characters"
          | "items"
          | "puzzles";
        const entityId = String(payload.entityId ?? "");
        const instruction = String(payload.instruction ?? "");
        const res = await refineSingleEntity(bundle, {
          entityKind,
          entityId,
          instruction,
          ...target,
        });
        await saveEntity(slug, entityKind, res.entity);
        return res;
      }
      case "generate-structure": {
        const proposal = await proposeStructure(bundle, target);
        const applied = await resetAndApplyPhaseProposal(
          slug,
          ["scenes", "puzzles", "dialogues"],
          false,
          proposal.items
        );
        return { proposal, ...applied };
      }
      case "review-logic":
        return reviewStoryLogic(bundle, target);
      default:
        throw new Error(`Unknown AI job kind: ${kind}`);
    }
  });

  res.status(202).json({ jobId });
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

app.put("/api/games/:slug/story-plan", async (req, res) => {
  try {
    const storyPlan =
      typeof req.body?.storyPlan === "string" ? req.body.storyPlan : "";
    await saveStoryPlan(req.params.slug, storyPlan);
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

app.post("/api/games/:slug/ai/refine-pitch", async (req, res) => {
  try {
    const bundle = await loadGameDesign(req.params.slug);
    const result = await refinePitch(bundle, {
      currentPitch: String(req.body?.currentPitch ?? bundle.pitch),
      instruction: String(req.body?.instruction ?? ""),
      mode: req.body?.mode === "generate" ? "generate" : "refine",
      locale: String(req.body?.locale ?? bundle.game.default_locale),
      providerId: typeof req.body?.providerId === "string" ? req.body.providerId : undefined,
      model: typeof req.body?.model === "string" ? req.body.model : undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/games/:slug/ai/generate-structure", async (req, res) => {
  try {
    const bundle = await loadGameDesign(req.params.slug);
    const proposal = await proposeStructure(bundle, {
      providerId: typeof req.body?.providerId === "string" ? req.body.providerId : undefined,
      model: typeof req.body?.model === "string" ? req.body.model : undefined,
    });
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
    const review = await reviewStoryLogic(bundle, {
      providerId: typeof req.body?.providerId === "string" ? req.body.providerId : undefined,
      model: typeof req.body?.model === "string" ? req.body.model : undefined,
    });
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
