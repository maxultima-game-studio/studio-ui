import fs from "node:fs/promises";
import type {
  AiProposal,
  GameDesignBundle,
  ProposalItem,
} from "@studio-ui/shared";

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

async function resolveGeminiApiKey(): Promise<string | undefined> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const fallbackPaths = [
    "/home/antigravity/upload/secrets.env",
    ".env",
  ];
  for (const p of fallbackPaths) {
    try {
      const content = await fs.readFile(p, "utf8");
      const match = content.match(/^GEMINI_API_KEY=(.+)$/m);
      if (match?.[1]) {
        return match[1].trim().replace(/^["']|["']$/g, "");
      }
    } catch {
      // ignore missing file
    }
  }
  return undefined;
}

async function callGeminiJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  const apiKey = await resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Set GEMINI_API_KEY in environment to use AI assistance."
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const payload = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini API returned empty content");
  }
  return JSON.parse(text) as T;
}

export async function isAiConfigured(): Promise<{ configured: boolean; model: string }> {
  const key = await resolveGeminiApiKey();
  return { configured: Boolean(key), model: DEFAULT_MODEL };
}

export async function proposeExpandPitch(
  bundle: GameDesignBundle
): Promise<AiProposal> {
  const locales = bundle.game.locales.join(", ");
  const systemPrompt = `You are a senior narrative designer for 2D point-and-click adventure games.
Return ONLY valid JSON matching:
{
  "summary": "short human summary",
  "world": { "locked": false, "setting": { "cs": "...", "en": "..." }, "visual_style": "...", "themes": ["..."], "acts": [{ "id": "act-1", "title": { "cs": "...", "en": "..." }, "summary": { "cs": "...", "en": "..." } }] },
  "characters": [{ "id": "kebab-id", "locked": false, "name": { "cs": "...", "en": "..." }, "role": "protagonist|npc|antagonist", "bio": { "cs": "...", "en": "..." }, "voice_notes": "...", "visual_brief": "...", "asset_slots": [{ "slot_id": "kebab-slot", "kind": "portrait|animation", "animation_name": "idle", "brief": "..." }] }],
  "items": [{ "id": "kebab-id", "locked": false, "name": { "cs": "...", "en": "..." }, "description": { "cs": "...", "en": "..." }, "visual_brief": "...", "asset_slots": [{ "slot_id": "kebab-slot", "kind": "icon", "brief": "..." }] }],
  "flags": [{ "id": "kebab-id", "description": { "cs": "...", "en": "..." }, "initial_value": false }]
}
All IDs MUST be lowercase kebab-case. Provide translations for all locales: ${locales}.`;

  const userPrompt = `Game config: ${JSON.stringify(bundle.game)}
Pitch:
${bundle.pitch}

Existing locked entity IDs (do NOT overwrite):
- world locked: ${bundle.world.locked}
- characters: ${bundle.characters.filter((c) => c.locked).map((c) => c.id).join(", ")}
- items: ${bundle.items.filter((i) => i.locked).map((i) => i.id).join(", ")}

Propose a concise, coherent expansion of the world, 2-4 characters, 2-4 items, and 2-4 flags.`;

  const raw = await callGeminiJson<{
    summary: string;
    world?: unknown;
    characters?: Array<{ id: string }>;
    items?: Array<{ id: string }>;
    flags?: Array<{ id: string }>;
  }>(systemPrompt, userPrompt);

  const items: ProposalItem[] = [];
  if (raw.world) {
    items.push({
      key: "world:world",
      entity_type: "world",
      entity_id: "world",
      action: "update",
      locked: bundle.world.locked,
      summary: "World bible & acts",
      data: raw.world,
    });
  }
  for (const ch of raw.characters ?? []) {
    const existing = bundle.characters.find((c) => c.id === ch.id);
    items.push({
      key: `character:${ch.id}`,
      entity_type: "character",
      entity_id: ch.id,
      action: existing ? "update" : "create",
      locked: Boolean(existing?.locked),
      summary: `Character: ${ch.id}`,
      data: ch,
    });
  }
  for (const it of raw.items ?? []) {
    const existing = bundle.items.find((i) => i.id === it.id);
    items.push({
      key: `item:${it.id}`,
      entity_type: "item",
      entity_id: it.id,
      action: existing ? "update" : "create",
      locked: Boolean(existing?.locked),
      summary: `Item: ${it.id}`,
      data: it,
    });
  }
  for (const fl of raw.flags ?? []) {
    const existing = bundle.flags.flags.find((f) => f.id === fl.id);
    items.push({
      key: `flag:${fl.id}`,
      entity_type: "flag",
      entity_id: fl.id,
      action: existing ? "update" : "create",
      locked: false,
      summary: `Flag: ${fl.id}`,
      data: fl,
    });
  }

  return {
    kind: "expand-pitch",
    model: DEFAULT_MODEL,
    summary: raw.summary ?? "AI expansion proposal",
    items,
  };
}

export async function proposeStructure(
  bundle: GameDesignBundle
): Promise<AiProposal> {
  const locales = bundle.game.locales.join(", ");
  const systemPrompt = `You are a senior point-and-click adventure game designer.
Return ONLY valid JSON matching:
{
  "summary": "short human summary",
  "scenes": [{ "id": "kebab-id", "locked": false, "act": "act-1", "title": { "cs": "...", "en": "..." }, "description": { "cs": "...", "en": "..." }, "visual_brief": "...", "graph_position": { "x": 100, "y": 150 }, "characters": [], "exits": [{ "id": "exit-id", "target_scene_id": "other-scene", "label": { "cs": "...", "en": "..." } }], "hotspots": [{ "id": "hs-id", "label": { "cs": "...", "en": "..." }, "description": { "cs": "...", "en": "..." } }], "asset_slots": [{ "slot_id": "scene-bg", "kind": "background", "brief": "..." }] }],
  "puzzles": [{ "id": "kebab-id", "locked": false, "scene_id": "scene-id", "title": { "cs": "...", "en": "..." }, "summary": { "cs": "...", "en": "..." }, "requires": [], "effects": [] }],
  "dialogues": [{ "id": "kebab-id", "locked": false, "scene_id": "scene-id", "character_id": "char-id", "title": { "cs": "...", "en": "..." }, "start_node_id": "start", "nodes": { "start": { "id": "start", "type": "npc_line", "position": { "x": 80, "y": 120 }, "speaker_id": "char-id", "text": { "cs": "...", "en": "..." }, "next_node_id": "end" }, "end": { "id": "end", "type": "end", "position": { "x": 420, "y": 120 } } } }]
}
All IDs MUST be lowercase kebab-case. Reference ONLY existing characters/items/flags or newly proposed scenes. Fill locales: ${locales}.`;

  const userPrompt = `Current game design context:
${JSON.stringify({
    game: bundle.game,
    world: bundle.world,
    characters: bundle.characters.map((c) => ({ id: c.id, name: c.name, role: c.role })),
    items: bundle.items.map((i) => ({ id: i.id, name: i.name })),
    flags: bundle.flags.flags,
    existingScenes: bundle.scenes.map((s) => ({ id: s.id, locked: s.locked })),
  })}
Propose 2-3 connected scenes, 1-2 puzzles, and 1 branching dialogue tree.`;

  const raw = await callGeminiJson<{
    summary: string;
    scenes?: Array<{ id: string }>;
    puzzles?: Array<{ id: string }>;
    dialogues?: Array<{ id: string }>;
  }>(systemPrompt, userPrompt);

  const items: ProposalItem[] = [];
  for (const s of raw.scenes ?? []) {
    const existing = bundle.scenes.find((x) => x.id === s.id);
    items.push({
      key: `scene:${s.id}`,
      entity_type: "scene",
      entity_id: s.id,
      action: existing ? "update" : "create",
      locked: Boolean(existing?.locked),
      summary: `Scene: ${s.id}`,
      data: s,
    });
  }
  for (const p of raw.puzzles ?? []) {
    const existing = bundle.puzzles.find((x) => x.id === p.id);
    items.push({
      key: `puzzle:${p.id}`,
      entity_type: "puzzle",
      entity_id: p.id,
      action: existing ? "update" : "create",
      locked: Boolean(existing?.locked),
      summary: `Puzzle: ${p.id}`,
      data: p,
    });
  }
  for (const d of raw.dialogues ?? []) {
    const existing = bundle.dialogues.find((x) => x.id === d.id);
    items.push({
      key: `dialogue:${d.id}`,
      entity_type: "dialogue",
      entity_id: d.id,
      action: existing ? "update" : "create",
      locked: Boolean(existing?.locked),
      summary: `Dialogue: ${d.id}`,
      data: d,
    });
  }

  return {
    kind: "generate-structure",
    model: DEFAULT_MODEL,
    summary: raw.summary ?? "AI structure proposal",
    items,
  };
}

export async function reviewStoryLogic(
  bundle: GameDesignBundle
): Promise<{
  model: string;
  findings: Array<{
    severity: "error" | "warning" | "suggestion";
    title: { cs: string; en: string };
    detail: { cs: string; en: string };
  }>;
}> {
  const systemPrompt = `You are a QA and narrative designer auditing a point-and-click adventure game design for plot holes, puzzle softlocks, unreachable objectives, or weak motivation.
Return ONLY valid JSON:
{
  "findings": [
    {
      "severity": "error|warning|suggestion",
      "title": { "cs": "...", "en": "..." },
      "detail": { "cs": "...", "en": "..." }
    }
  ]
}`;

  const raw = await callGeminiJson<{
    findings: Array<{
      severity: "error" | "warning" | "suggestion";
      title: { cs: string; en: string };
      detail: { cs: string; en: string };
    }>;
  }>(systemPrompt, JSON.stringify(bundle));

  return {
    model: DEFAULT_MODEL,
    findings: raw.findings ?? [],
  };
}
