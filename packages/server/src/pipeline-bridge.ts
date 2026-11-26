import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { GameDesignBundle, PipelineSlotStatus } from "@studio-ui/shared";
import { resolveGameDir } from "./design-store.js";

/**
 * Pipeline Bridge:
 * Reads optional spec status from game-<slug>/specs/ without owning or mutating it.
 * Provides a clean hook point to invoke pipeline-* CLI/HTTP commands once pipeline-pnc-pixel is connected.
 */
export async function getPipelineStatuses(
  slug: string,
  bundle: GameDesignBundle
): Promise<Record<string, PipelineSlotStatus>> {
  const gameDir = await resolveGameDir(slug);
  const specsDir = path.join(gameDir, "specs");

  const slotIds = new Set<string>();
  for (const s of bundle.scenes) s.asset_slots.forEach((a) => slotIds.add(a.slot_id));
  for (const c of bundle.characters) c.asset_slots.forEach((a) => slotIds.add(a.slot_id));
  for (const i of bundle.items) i.asset_slots.forEach((a) => slotIds.add(a.slot_id));

  const result: Record<string, PipelineSlotStatus> = {};

  for (const slotId of slotIds) {
    const candidateJson = path.join(specsDir, `${slotId}.spec.json`);
    const candidateYaml = path.join(specsDir, `${slotId}.spec.yaml`);

    let status: PipelineSlotStatus = {
      slot_id: slotId,
      status: "unlinked",
      message: "Pipeline not yet linked for this slot",
    };

    for (const candidate of [candidateJson, candidateYaml]) {
      try {
        const raw = await fs.readFile(candidate, "utf8");
        const parsed = candidate.endsWith(".json")
          ? JSON.parse(raw)
          : YAML.parse(raw);
        if (parsed && typeof parsed === "object") {
          status = {
            slot_id: slotId,
            status: parsed.status ?? "todo",
            spec_path: path.relative(gameDir, candidate),
            preview_url: parsed.preview_path
              ? `/api/games/${encodeURIComponent(slug)}/pipeline/asset?path=${encodeURIComponent(parsed.preview_path)}`
              : undefined,
            message: parsed.notes,
          };
          break;
        }
      } catch {
        // Spec file does not exist yet
      }
    }

    result[slotId] = status;
  }

  return result;
}

export async function triggerPipelineSlot(
  slug: string,
  slotId: string
): Promise<{
  ok: boolean;
  status: "not_configured" | "queued";
  slot_id: string;
  message: { cs: string; en: string };
}> {
  // Future hook: read pipeline command from game.config.yaml or STUDIO_PIPELINE_CMD
  // and spawn pipeline-pnc-pixel for the requested slot_id.
  return {
    ok: false,
    status: "not_configured",
    slot_id: slotId,
    message: {
      cs: `Pipeline adaptér pro hru "${slug}" a slot "${slotId}" je připraven, ale zatím není napojena žádná grafická pipeline (pipeline-pnc-pixel).`,
      en: `Pipeline bridge for game "${slug}" and slot "${slotId}" is ready, but no graphics pipeline (pipeline-pnc-pixel) is connected yet.`,
    },
  };
}
