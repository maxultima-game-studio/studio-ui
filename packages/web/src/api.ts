import type {
  AiProposal,
  FlagsFile,
  GameConfig,
  GameDesignBundle,
  PipelineSlotStatus,
  ProposalItem,
  ValidationIssue,
  WorldBible,
} from "@studio-ui/shared";

export interface DiscoveredGame {
  slug: string;
  path: string;
  hasDesign: boolean;
}

export type AiProviderKind = "gemini" | "opencode" | "openai-compatible";

export interface PublicAiProvider {
  id: string;
  name: string;
  kind: AiProviderKind;
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyPreview?: string;
  defaultModel?: string;
  builtIn?: boolean;
}

export interface AiModelInfo {
  id: string;
  label: string;
  providerId: string;
  providerName: string;
}

export interface AiLogEntry {
  id: string;
  timestamp: string;
  action: string;
  providerId: string;
  providerName: string;
  model: string;
  status: "pending" | "ok" | "error";
  durationMs: number;
  systemPrompt: string;
  userPrompt: string;
  responseText?: string;
  error?: string;
}

export interface PhaseApplyResult {
  proposal: AiProposal;
  applied: string[];
  skippedLocked: string[];
  removedCount: number;
}

export interface HealthResponse {
  ok: boolean;
  gamesRoot: string;
  ai: {
    configured: boolean;
    defaultModel: string;
    defaultProviderId: string;
    availableModels: AiModelInfo[];
  };
}

export interface LoadedGameResponse {
  bundle: GameDesignBundle;
  issues: ValidationIssue[];
  pipeline: Record<string, PipelineSlotStatus>;
}

export interface FloatingWindowPref {
  open: boolean;
  pinned: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StudioUiPrefs {
  selectedSlug?: string;
  tab?: "pitch" | "story" | "entities" | "scenes" | "dialogues";
  uiLocale?: "cs" | "en";
  contentLocale?: string;
  darkMode?: boolean;
  selectedModelKey?: string;
  chatWindow?: FloatingWindowPref;
  notifWindow?: FloatingWindowPref;
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON proxy error
  }
  if (!res.ok) {
    const errMsg =
      (data as { error?: string } | null)?.error ??
      (text.trim() ? text.slice(0, 260) : `HTTP ${res.status}`);
    throw new Error(errMsg);
  }
  return data as T;
}

async function runAiJob<T>(
  slug: string,
  kind:
    | "refine-pitch"
    | "plan-story"
    | "expand-story"
    | "refine-act"
    | "generate-act-entities"
    | "refine-entity"
    | "generate-structure"
    | "review-logic",
  payload: Record<string, unknown>,
  onTick?: () => void
): Promise<T> {
  const { jobId } = await req<{ jobId: string }>(
    `/api/games/${encodeURIComponent(slug)}/ai/jobs`,
    {
      method: "POST",
      body: JSON.stringify({ kind, payload }),
    }
  );

  // Immediately refresh logs so the pending prompt appears right away
  setTimeout(() => onTick?.(), 150);

  const maxWaitMs = 180_000;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 700));
    onTick?.();
    const job = await req<{
      id: string;
      status: "running" | "done" | "error";
      result?: T;
      error?: string;
    }>(`/api/ai/jobs/${encodeURIComponent(jobId)}`);

    if (job.status === "done") return job.result as T;
    if (job.status === "error") {
      throw new Error(job.error ?? "AI job failed");
    }
  }

  throw new Error("AI request timed out after 180s");
}

export const api = {
  health: () => req<HealthResponse>("/api/health"),
  getUiPrefs: () => req<{ prefs: StudioUiPrefs }>("/api/ui/prefs"),
  saveUiPrefs: (prefs: Partial<StudioUiPrefs>) =>
    req<{ prefs: StudioUiPrefs }>("/api/ui/prefs", {
      method: "PUT",
      body: JSON.stringify(prefs),
    }),
  listProviders: () =>
    req<{ providers: PublicAiProvider[]; models: AiModelInfo[] }>("/api/ai/providers"),
  saveProvider: (payload: {
    id: string;
    name: string;
    kind: AiProviderKind;
    baseUrl: string;
    apiKey?: string;
    defaultModel?: string;
  }) =>
    req<{ provider: PublicAiProvider; models: AiModelInfo[] }>("/api/ai/providers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteProvider: (id: string) =>
    req<{ ok: boolean; models: AiModelInfo[] }>(
      `/api/ai/providers/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    ),
  refreshProviderModels: (id: string) =>
    req<{ models: AiModelInfo[] }>(
      `/api/ai/providers/${encodeURIComponent(id)}/models`,
      { method: "POST" }
    ),
  getAiLogs: () => req<{ logs: AiLogEntry[] }>("/api/ai/logs"),
  clearAiLogs: () => req<{ ok: boolean }>("/api/ai/logs", { method: "DELETE" }),
  listGames: () => req<{ games: DiscoveredGame[]; gamesRoot: string }>("/api/games"),
  loadDesign: (slug: string) =>
    req<LoadedGameResponse>(`/api/games/${encodeURIComponent(slug)}/design`),
  saveGame: (slug: string, game: GameConfig) =>
    req<GameConfig>(`/api/games/${encodeURIComponent(slug)}/game`, {
      method: "PUT",
      body: JSON.stringify(game),
    }),
  savePitch: (slug: string, pitch: string) =>
    req<{ ok: boolean }>(`/api/games/${encodeURIComponent(slug)}/pitch`, {
      method: "PUT",
      body: JSON.stringify({ pitch }),
    }),
  saveStoryPlan: (slug: string, storyPlan: string) =>
    req<{ ok: boolean }>(`/api/games/${encodeURIComponent(slug)}/story-plan`, {
      method: "PUT",
      body: JSON.stringify({ storyPlan }),
    }),
  saveWorld: (slug: string, world: WorldBible) =>
    req<WorldBible>(`/api/games/${encodeURIComponent(slug)}/world`, {
      method: "PUT",
      body: JSON.stringify(world),
    }),
  saveFlags: (slug: string, flags: FlagsFile) =>
    req<FlagsFile>(`/api/games/${encodeURIComponent(slug)}/flags`, {
      method: "PUT",
      body: JSON.stringify(flags),
    }),
  saveEntity: <T>(
    slug: string,
    kind: "characters" | "items" | "scenes" | "puzzles" | "dialogues",
    entity: T
  ) =>
    req<T>(`/api/games/${encodeURIComponent(slug)}/entities/${kind}`, {
      method: "PUT",
      body: JSON.stringify(entity),
    }),
  deleteEntity: (
    slug: string,
    kind: "characters" | "items" | "scenes" | "puzzles" | "dialogues",
    id: string
  ) =>
    req<{ ok: boolean }>(
      `/api/games/${encodeURIComponent(slug)}/entities/${kind}/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    ),
  aiRefinePitch: (
    slug: string,
    payload: {
      currentPitch: string;
      instruction: string;
      mode: "generate" | "refine";
      locale: string;
      providerId?: string;
      model?: string;
    },
    onTick?: () => void
  ) =>
    runAiJob<{ model: string; providerId: string; pitch: string; rationale: string }>(
      slug,
      "refine-pitch",
      payload,
      onTick
    ),
  aiPlanStory: (
    slug: string,
    payload: {
      currentPitch: string;
      currentPlan: string;
      actCount: number;
      message: string;
      history: Array<{ role: "user" | "assistant"; text: string }>;
      locale: string;
      providerId?: string;
      model?: string;
    },
    onTick?: () => void
  ) =>
    runAiJob<{
      model: string;
      reply: string;
      suggestedActCount: number;
      storyPlan: string;
    }>(slug, "plan-story", payload, onTick),
  aiExpandStory: (
    slug: string,
    payload?: {
      providerId?: string;
      model?: string;
      actCount?: number;
      storyPlan?: string;
    },
    onTick?: () => void
  ) =>
    runAiJob<{
      model: string;
      summary: string;
      applied: string[];
      skippedLocked: string[];
      removedCount: number;
    }>(slug, "expand-story", payload ?? {}, onTick),
  aiRefineAct: (
    slug: string,
    payload: {
      actId: string;
      instruction: string;
      providerId?: string;
      model?: string;
    },
    onTick?: () => void
  ) =>
    runAiJob<{ model: string; rationale: string }>(
      slug,
      "refine-act",
      payload,
      onTick
    ),
  aiGenerateActEntities: (
    slug: string,
    payload: {
      actId: string;
      providerId?: string;
      model?: string;
    },
    onTick?: () => void
  ) => runAiJob<PhaseApplyResult>(slug, "generate-act-entities", payload, onTick),
  aiRefineEntity: (
    slug: string,
    payload: {
      entityKind: "characters" | "items" | "puzzles";
      entityId: string;
      instruction: string;
      providerId?: string;
      model?: string;
    },
    onTick?: () => void
  ) =>
    runAiJob<{ model: string; rationale: string }>(
      slug,
      "refine-entity",
      payload,
      onTick
    ),
  aiGenerateStructure: (
    slug: string,
    target?: { providerId?: string; model?: string },
    onTick?: () => void
  ) => runAiJob<PhaseApplyResult>(slug, "generate-structure", target ?? {}, onTick),
  aiApplyProposal: (slug: string, items: ProposalItem[]) =>
    req<{ applied: string[]; skippedLocked: string[] }>(
      `/api/games/${encodeURIComponent(slug)}/ai/apply-proposal`,
      {
        method: "POST",
        body: JSON.stringify({ items }),
      }
    ),
  aiReviewLogic: (
    slug: string,
    target?: { providerId?: string; model?: string },
    onTick?: () => void
  ) =>
    runAiJob<{
      model: string;
      findings: Array<{
        severity: "error" | "warning" | "suggestion";
        title: { cs: string; en: string };
        detail: { cs: string; en: string };
      }>;
    }>(slug, "review-logic", target ?? {}, onTick),
  triggerPipelineSlot: (slug: string, slotId: string) =>
    req<{
      ok: boolean;
      status: string;
      slot_id: string;
      message: { cs: string; en: string };
    }>(`/api/games/${encodeURIComponent(slug)}/pipeline/trigger`, {
      method: "POST",
      body: JSON.stringify({ slot_id: slotId }),
    }),
};
