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

export interface LoadedGameResponse {
  bundle: GameDesignBundle;
  issues: ValidationIssue[];
  pipeline: Record<string, PipelineSlotStatus>;
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
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
  aiExpandPitch: (slug: string) =>
    req<AiProposal>(`/api/games/${encodeURIComponent(slug)}/ai/expand-pitch`, {
      method: "POST",
    }),
  aiGenerateStructure: (slug: string) =>
    req<AiProposal>(`/api/games/${encodeURIComponent(slug)}/ai/generate-structure`, {
      method: "POST",
    }),
  aiApplyProposal: (slug: string, items: ProposalItem[]) =>
    req<{ applied: string[]; skippedLocked: string[] }>(
      `/api/games/${encodeURIComponent(slug)}/ai/apply-proposal`,
      {
        method: "POST",
        body: JSON.stringify({ items }),
      }
    ),
  aiReviewLogic: (slug: string) =>
    req<{
      model: string;
      findings: Array<{
        severity: "error" | "warning" | "suggestion";
        title: { cs: string; en: string };
        detail: { cs: string; en: string };
      }>;
    }>(`/api/games/${encodeURIComponent(slug)}/ai/review-logic`, {
      method: "POST",
    }),
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
