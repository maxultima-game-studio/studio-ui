import type {
  Act,
  AiProposal,
  Character,
  GameDesignBundle,
  Item,
  ProposalItem,
  Puzzle,
  WorldBible,
} from "@studio-ui/shared";
import {
  callAiJson,
  DEFAULT_GEMINI_MODEL,
  getAllProviders,
  listAllModels,
} from "./ai-providers.js";

export interface AiTarget {
  providerId?: string;
  model?: string;
}

export async function isAiConfigured() {
  const providers = await getAllProviders();
  const models = await listAllModels();
  return {
    configured: providers.some(
      (p) => Boolean(p.apiKey) || p.kind === "openai-compatible"
    ),
    defaultModel: DEFAULT_GEMINI_MODEL,
    defaultProviderId: "gemini-default",
    availableModels: models,
  };
}

export async function refinePitch(
  bundle: GameDesignBundle,
  params: {
    currentPitch: string;
    instruction: string;
    mode: "generate" | "refine";
    locale: string;
    providerId?: string;
    model?: string;
  }
): Promise<{
  model: string;
  providerId: string;
  pitch: string;
  rationale: string;
}> {
  const systemPrompt = `You are a creative director specializing in 2D point-and-click adventure games.
Return ONLY valid JSON:
{
  "pitch": "Markdown pitch text (1-2 concise, vivid paragraphs capturing premise, protagonist, conflict, tone, and hook)",
  "rationale": "1-2 short sentences explaining what was created or improved"
}
Write in language "${params.locale}" (unless the user instruction explicitly asks for another language).`;

  const userPrompt =
    params.mode === "generate"
      ? `Game settings: ${JSON.stringify(bundle.game)}
User idea / prompt:
${params.instruction || "Create an atmospheric original adventure pitch."}

Generate a strong, concise game pitch in Markdown.`
      : `Game settings: ${JSON.stringify(bundle.game)}
Current pitch:
${params.currentPitch}

User refinement instruction:
${params.instruction || "Tighten the hook, clarify the protagonist's goal and stakes, and keep it concise."}

Return an improved version of the pitch in Markdown.`;

  const { data, model, providerId } = await callAiJson<{
    pitch: string;
    rationale: string;
  }>({
    providerId: params.providerId,
    model: params.model,
    sessionId: `studio-ui-${bundle.slug}`,
    action: params.mode === "generate" ? "pitch:generate" : "pitch:refine",
    systemPrompt,
    userPrompt,
  });

  return {
    model,
    providerId,
    pitch: data.pitch ?? params.currentPitch,
    rationale: data.rationale ?? "",
  };
}

/**
 * Step 1 (Planning sub-conversation): Discuss scope, act count, pacing, and outline with AI before expanding into Step 2.
 */
export async function planStoryActs(
  bundle: GameDesignBundle,
  params: {
    currentPitch: string;
    currentPlan: string;
    message: string;
    history: Array<{ role: "user" | "assistant"; text: string }>;
    locale: string;
    providerId?: string;
    model?: string;
  }
): Promise<{
  model: string;
  reply: string;
  suggestedActCount?: number;
  storyPlan: string;
}> {
  const systemPrompt = `You are a prompt engineer and narrative producer helping a game designer craft a clear, high-leverage GENERATION BRIEF (prompt) that will later be used in Step 2 to expand the pitch into full Acts.
IMPORTANT: Do NOT write out the actual story plot or detailed scene-by-scene beats of each act yet — that belongs to Step 2.
Instead, turn the user's rough request into a crisp, well-structured Markdown prompt/brief specifying:
- Scope & structure (recommended number of acts, target playtime, pacing)
- Tone, atmosphere, and thematic focus
- Narrative direction & constraints (twist style, ending type, what to emphasize or avoid)
- Clear instructions for how Step 2 should structure the acts from the pitch.

Return ONLY valid JSON:
{
  "reply": "Short conversational response (2–3 sentences) explaining how you refined the generation brief or asking 1 focused follow-up if helpful",
  "suggestedActCount": 3,
  "storyPlan": "The refined Markdown generation brief/prompt ready to feed into Step 2 (concise, structured with headings/bullets, no full plot writing yet)"
}
Write in language "${params.locale}".`;

  const historyText = params.history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.text}`)
    .join("\n");

  const userPrompt = `Game settings: ${JSON.stringify(bundle.game)}
Pitch:
${params.currentPitch}

Current generation brief:
${params.currentPlan || "(empty yet)"}

Recent conversation:
${historyText || "(first message)"}

User's request / refinement:
${params.message || "Vytvoř jasné a strukturované zadání (prompt) pro rozpracování této nosné myšlenky do aktů – včetně doporučeného počtu aktů, tempa, tónu a mantinelů."}`;

  const { data, model } = await callAiJson<{
    reply: string;
    suggestedActCount?: number;
    storyPlan?: string;
  }>({
    providerId: params.providerId,
    model: params.model,
    sessionId: `studio-ui-${bundle.slug}`,
    action: "story:plan-prompt",
    systemPrompt,
    userPrompt,
  });

  const count = Number(data.suggestedActCount);
  return {
    model,
    reply: data.reply ?? "",
    suggestedActCount:
      Number.isFinite(count) && count >= 1 ? Math.round(count) : undefined,
    storyPlan: data.storyPlan ?? params.currentPlan,
  };
}

function coerceString(val: unknown, preferredLocale = "cs"): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const rec = val as Record<string, unknown>;
    const pick =
      rec[preferredLocale] ?? rec.cs ?? rec.en ?? Object.values(rec)[0];
    if (typeof pick === "string") return pick;
  }
  return val == null ? "" : String(val);
}

function coerceLocalizedText(
  val: unknown,
  defaultLocale: string
): Record<string, string> {
  if (typeof val === "string") return { [defaultLocale]: val };
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }
  return {};
}

function coerceLocalizedList(
  val: unknown,
  defaultLocale: string
): Record<string, string[]> {
  if (Array.isArray(val)) {
    return {
      [defaultLocale]: val
        .map((item) => coerceString(item, defaultLocale).trim())
        .filter(Boolean),
    };
  }
  if (val && typeof val === "object") {
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        out[k] = v
          .map((item) => coerceString(item, k).trim())
          .filter(Boolean);
      } else if (typeof v === "string" && v.trim()) {
        out[k] = v
          .split(/\r?\n/)
          .map((s) => s.replace(/^[-*•]\s*/, "").trim())
          .filter(Boolean);
      }
    }
    return out;
  }
  return {};
}

function normalizeAct(raw: unknown, idx: number, defaultLocale: string): Act {
  const act = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const rawId = typeof act.id === "string" ? act.id : `act-${idx + 1}`;
  const id =
    rawId
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || `act-${idx + 1}`;
  return {
    id,
    locked: Boolean(act.locked),
    title:
      Object.keys(coerceLocalizedText(act.title, defaultLocale)).length > 0
        ? coerceLocalizedText(act.title, defaultLocale)
        : { [defaultLocale]: `Akt ${idx + 1}` },
    goal: coerceLocalizedText(act.goal, defaultLocale),
    visual_style: coerceLocalizedText(act.visual_style, defaultLocale),
    summary: coerceLocalizedText(act.summary, defaultLocale),
    beats: coerceLocalizedList(act.beats, defaultLocale),
    puzzle_concepts: coerceLocalizedList(act.puzzle_concepts, defaultLocale),
    transition: coerceLocalizedText(act.transition, defaultLocale),
  };
}

function normalizeWorldBible(
  raw: unknown,
  defaultLocale: string
): WorldBible {
  const w = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const rawThemes = Array.isArray(w.themes) ? w.themes : [];
  const rawActs = Array.isArray(w.acts) ? w.acts : [];

  return {
    locked: Boolean(w.locked),
    setting: coerceLocalizedText(w.setting, defaultLocale),
    visual_style: coerceString(w.visual_style, defaultLocale),
    themes: rawThemes
      .map((t) => coerceString(t, defaultLocale).trim())
      .filter(Boolean),
    acts: rawActs.map((a, idx) => normalizeAct(a, idx, defaultLocale)),
  };
}

/**
 * Step 1 -> Step 2: Expand Pitch + Story Plan into a full, consistent multi-act Story Arc.
 */
export async function expandPitchToStory(
  bundle: GameDesignBundle,
  target?: AiTarget & { storyPlan?: string }
): Promise<{ model: string; summary: string; world: WorldBible }> {
  const locales = bundle.game.locales.join(", ");
  const storyPlan = (target?.storyPlan ?? bundle.story_plan ?? "").trim();

  const systemPrompt = `You are a lead narrative designer for 2D point-and-click adventure games.
Expand the pitch and generation brief into a complete, cohesive story from beginning to end split into structured Acts.
Follow the EXACT number of acts and constraints agreed in the Brief.
Each act MUST have its own specific visual_style, goal, summary, beats, puzzle_concepts, and transition to the next act (or ending).
Return ONLY valid JSON:
{
  "summary": "1-sentence plain string overview of the full story arc",
  "world": {
    "locked": false,
    "setting": { "cs": "...", "en": "..." },
    "visual_style": "Short plain string baseline style",
    "themes": ["theme-1", "theme-2"],
    "acts": [
      {
        "id": "act-1",
        "locked": false,
        "title": { "cs": "Akt 1: ...", "en": "Act 1: ..." },
        "goal": { "cs": "Hlavní cíl hráče v tomto aktu...", "en": "Player's primary goal in this act..." },
        "visual_style": { "cs": "Specifická paleta, osvětlení, nálada a vizuální motivy tohoto aktu...", "en": "Act-specific palette, lighting, mood, and visual motifs..." },
        "summary": { "cs": "Krátké čtivé shrnutí děje aktu (2–3 věty).", "en": "Short readable summary (2-3 sentences)." },
        "beats": {
          "cs": ["Story beat 1...", "Story beat 2...", "Story beat 3..."],
          "en": ["Story beat 1...", "Story beat 2...", "Story beat 3..."]
        },
        "puzzle_concepts": {
          "cs": ["Koncept puzzlu 1...", "Koncept puzzlu 2..."],
          "en": ["Puzzle concept 1...", "Puzzle concept 2..."]
        },
        "transition": { "cs": "Zvrat / přechod do dalšího aktu nebo vyústění...", "en": "Twist / transition to next act or finale..." }
      }
    ]
  }
}
All IDs MUST be lowercase kebab-case (act-1, act-2, ...). Fill ALL locales (${locales}) for localized fields.`;

  const userPrompt = `Game settings: ${JSON.stringify(bundle.game)}
Pitch:
${bundle.pitch}

Approved Generation Brief (follow act count, tone, constraints, and scope closely):
${storyPlan || "Choose the most natural multi-act structure from opening to finale."}

Generate all structured Acts from beginning to end.`;

  const { data, model } = await callAiJson<{
    summary: unknown;
    world: unknown;
  }>({
    providerId: target?.providerId,
    model: target?.model,
    sessionId: `studio-ui-${bundle.slug}`,
    action: "story:expand-acts",
    systemPrompt,
    userPrompt,
  });

  return {
    model,
    summary:
      coerceString(data.summary, bundle.game.default_locale) ||
      "Story arc generated",
    world: normalizeWorldBible(data.world, bundle.game.default_locale),
  };
}

/**
 * Step 2: Refine a single Act in the context of the full story.
 */
export async function refineSingleAct(
  bundle: GameDesignBundle,
  params: {
    actId: string;
    instruction: string;
    providerId?: string;
    model?: string;
  }
): Promise<{ model: string; act: Act; rationale: string }> {
  const locales = bundle.game.locales.join(", ");
  const actIndex = bundle.world.acts.findIndex((a) => a.id === params.actId);
  const targetAct = actIndex >= 0 ? bundle.world.acts[actIndex] : undefined;
  if (!targetAct) throw new Error(`Act "${params.actId}" not found`);

  const systemPrompt = `You are a lead narrative designer refining one structured Act of a point-and-click adventure story while keeping strict continuity with the pitch and all other acts.
Return ONLY valid JSON:
{
  "rationale": "1-2 short sentences explaining the changes",
  "act": {
    "id": "${params.actId}",
    "locked": ${Boolean(targetAct.locked)},
    "title": { "cs": "...", "en": "..." },
    "goal": { "cs": "...", "en": "..." },
    "visual_style": { "cs": "...", "en": "..." },
    "summary": { "cs": "...", "en": "..." },
    "beats": { "cs": ["..."], "en": ["..."] },
    "puzzle_concepts": { "cs": ["..."], "en": ["..."] },
    "transition": { "cs": "...", "en": "..." }
  }
}
Keep ID "${params.actId}" unchanged. Fill ALL locales: ${locales}.`;

  const userPrompt = `Pitch:
${bundle.pitch}

Full story acts for continuity:
${JSON.stringify(bundle.world.acts, null, 2)}

Target act to refine: ${params.actId}
User instruction:
${params.instruction || "Deepen the pacing, visual atmosphere, story beats, and puzzle concepts while keeping continuity with neighboring acts."}`;

  const { data, model } = await callAiJson<{
    rationale: unknown;
    act: unknown;
  }>({
    providerId: params.providerId,
    model: params.model,
    sessionId: `studio-ui-${bundle.slug}`,
    action: `act:refine:${params.actId}`,
    systemPrompt,
    userPrompt,
  });

  const normalized = normalizeAct(
    data.act,
    actIndex,
    bundle.game.default_locale
  );
  return {
    model,
    act: { ...normalized, id: params.actId },
    rationale: coerceString(data.rationale, bundle.game.default_locale),
  };
}

/**
 * Step 3: Generate detailed Characters, Items, Puzzles, and Flags for a specific Act (or all acts).
 */
export async function generateActEntities(
  bundle: GameDesignBundle,
  params: {
    actId: string;
    providerId?: string;
    model?: string;
  }
): Promise<AiProposal> {
  const locales = bundle.game.locales.join(", ");
  const act = bundle.world.acts.find((a) => a.id === params.actId);
  if (!act) throw new Error(`Act "${params.actId}" not found`);

  const systemPrompt = `You are a point-and-click adventure game designer defining concrete Characters, Items, Puzzles, and Flags for ONE specific Act.
Return ONLY valid JSON:
{
  "summary": "short summary",
  "characters": [
    { "id": "kebab-id", "locked": false, "acts": ["${params.actId}"], "name": { "cs": "...", "en": "..." }, "role": "protagonist|npc|antagonist", "bio": { "cs": "...", "en": "..." }, "voice_notes": "...", "visual_brief": "...", "asset_slots": [{ "slot_id": "kebab-portrait", "kind": "portrait", "brief": "..." }] }
  ],
  "items": [
    { "id": "kebab-id", "locked": false, "act": "${params.actId}", "name": { "cs": "...", "en": "..." }, "description": { "cs": "...", "en": "..." }, "visual_brief": "...", "asset_slots": [{ "slot_id": "kebab-icon", "kind": "icon", "brief": "..." }] }
  ],
  "puzzles": [
    { "id": "kebab-id", "locked": false, "act": "${params.actId}", "scene_id": "", "title": { "cs": "...", "en": "..." }, "summary": { "cs": "...", "en": "..." }, "requires": [{ "type": "item|flag", "ref": "kebab-id" }], "effects": [{ "type": "set_flag|give_item", "ref": "kebab-id", "value": true }] }
  ],
  "flags": [
    { "id": "kebab-id", "description": { "cs": "...", "en": "..." }, "initial_value": false }
  ]
}
All IDs MUST be lowercase kebab-case. Every flag/item referenced in puzzles MUST exist in flags/items (or existing items/flags). Fill ALL locales: ${locales}.`;

  const userPrompt = `Game settings: ${JSON.stringify(bundle.game)}
World setting: ${JSON.stringify(bundle.world.setting)}
Target Act: ${JSON.stringify(act)}
Existing characters (reuse protagonist or recurring NPCs where appropriate, do not duplicate locked ones):
${JSON.stringify(bundle.characters.map((c) => ({ id: c.id, name: c.name, role: c.role, locked: c.locked, acts: c.acts })))}
Existing flags: ${JSON.stringify(bundle.flags.flags.map((f) => f.id))}

Design 2–3 characters, 2–4 inventory items, 2–3 clever adventure puzzles, and 2–4 flags for "${params.actId}".`;

  const { data: raw, model: usedModel } = await callAiJson<{
    summary: string;
    characters?: Array<Character>;
    items?: Array<Item>;
    puzzles?: Array<Puzzle>;
    flags?: Array<{ id: string }>;
  }>({
    providerId: params.providerId,
    model: params.model,
    sessionId: `studio-ui-${bundle.slug}`,
    action: `act:entities:${params.actId}`,
    systemPrompt,
    userPrompt,
  });

  const items: ProposalItem[] = [];
  for (const ch of raw.characters ?? []) {
    const existing = bundle.characters.find((c) => c.id === ch.id);
    const mergedActs = Array.from(
      new Set([...(existing?.acts ?? []), ...(ch.acts ?? []), params.actId])
    );
    items.push({
      key: `character:${ch.id}`,
      entity_type: "character",
      entity_id: ch.id,
      action: existing ? "update" : "create",
      locked: Boolean(existing?.locked),
      summary: `Character: ${ch.id}`,
      data: { ...ch, acts: mergedActs },
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
      data: { ...it, act: it.act || params.actId },
    });
  }
  for (const pz of raw.puzzles ?? []) {
    const existing = bundle.puzzles.find((p) => p.id === pz.id);
    items.push({
      key: `puzzle:${pz.id}`,
      entity_type: "puzzle",
      entity_id: pz.id,
      action: existing ? "update" : "create",
      locked: Boolean(existing?.locked),
      summary: `Puzzle: ${pz.id}`,
      data: { ...pz, act: pz.act || params.actId, scene_id: pz.scene_id ?? "" },
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
    model: usedModel,
    summary: raw.summary ?? `Entities for ${params.actId}`,
    items,
  };
}

/**
 * Step 3: Refine or redefine a single Character, Item, or Puzzle via AI instruction.
 */
export async function refineSingleEntity(
  bundle: GameDesignBundle,
  params: {
    entityKind: "characters" | "items" | "puzzles";
    entityId: string;
    instruction: string;
    providerId?: string;
    model?: string;
  }
): Promise<{ model: string; entity: Character | Item | Puzzle; rationale: string }> {
  const locales = bundle.game.locales.join(", ");
  const existing = (bundle[params.entityKind] as Array<{ id: string }>).find(
    (e) => e.id === params.entityId
  );
  if (!existing) {
    throw new Error(`${params.entityKind}/${params.entityId} not found`);
  }

  const systemPrompt = `You are a point-and-click adventure game designer refining or redefining a single "${params.entityKind.slice(0, -1)}" entity.
Return ONLY valid JSON:
{
  "rationale": "1-2 short sentences explaining the changes",
  "entity": { ...exact same schema structure as the input entity... }
}
Keep "id": "${params.entityId}" unchanged. Fill ALL locales: ${locales}.`;

  const userPrompt = `Story context:
${JSON.stringify({
    setting: bundle.world.setting,
    acts: bundle.world.acts,
    items: bundle.items.map((i) => i.id),
    flags: bundle.flags.flags.map((f) => f.id),
  })}

Current entity:
${JSON.stringify(existing, null, 2)}

User instruction:
${params.instruction || "Make this entity more distinctive, atmospheric, and tightly tied to the story."}`;

  const { data, model } = await callAiJson<{
    rationale: string;
    entity: Character | Item | Puzzle;
  }>({
    providerId: params.providerId,
    model: params.model,
    sessionId: `studio-ui-${bundle.slug}`,
    action: `entity:refine:${params.entityId}`,
    systemPrompt,
    userPrompt,
  });

  return {
    model,
    entity: { ...data.entity, id: params.entityId } as Character | Item | Puzzle,
    rationale: data.rationale ?? "",
  };
}

export async function proposeStructure(
  bundle: GameDesignBundle,
  target?: AiTarget
): Promise<AiProposal> {
  const locales = bundle.game.locales.join(", ");
  const systemPrompt = `You are a senior point-and-click adventure game designer.
Return ONLY valid JSON matching:
{
  "summary": "short human summary",
  "scenes": [{ "id": "kebab-id", "locked": false, "act": "act-1", "title": { "cs": "...", "en": "..." }, "description": { "cs": "...", "en": "..." }, "visual_brief": "...", "graph_position": { "x": 100, "y": 150 }, "characters": [], "exits": [{ "id": "exit-id", "target_scene_id": "other-scene", "label": { "cs": "...", "en": "..." } }], "hotspots": [{ "id": "hs-id", "label": { "cs": "...", "en": "..." }, "description": { "cs": "...", "en": "..." } }], "asset_slots": [{ "slot_id": "scene-bg", "kind": "background", "brief": "..." }] }],
  "puzzles": [{ "id": "kebab-id", "locked": false, "act": "act-1", "scene_id": "scene-id", "title": { "cs": "...", "en": "..." }, "summary": { "cs": "...", "en": "..." }, "requires": [], "effects": [] }],
  "dialogues": [{ "id": "kebab-id", "locked": false, "scene_id": "scene-id", "character_id": "char-id", "title": { "cs": "...", "en": "..." }, "start_node_id": "start", "nodes": { "start": { "id": "start", "type": "npc_line", "position": { "x": 80, "y": 120 }, "speaker_id": "char-id", "text": { "cs": "...", "en": "..." }, "next_node_id": "end" }, "end": { "id": "end", "type": "end", "position": { "x": 420, "y": 120 } } } }]
}
All IDs MUST be lowercase kebab-case. Reference ONLY existing characters/items/flags or newly proposed scenes. Fill locales: ${locales}.`;

  const userPrompt = `Current game design context:
${JSON.stringify({
    game: bundle.game,
    world: bundle.world,
    characters: bundle.characters.map((c) => ({ id: c.id, name: c.name, role: c.role })),
    items: bundle.items.map((i) => ({ id: i.id, name: i.name })),
    puzzles: bundle.puzzles.map((p) => ({ id: p.id, act: p.act, title: p.title })),
    flags: bundle.flags.flags,
    existingScenes: bundle.scenes.map((s) => ({ id: s.id, locked: s.locked })),
  })}
Propose 2-4 connected scenes, map puzzles to scenes, and create 1-2 branching dialogue trees.`;

  const { data: raw, model: usedModel } = await callAiJson<{
    summary: string;
    scenes?: Array<{ id: string }>;
    puzzles?: Array<{ id: string }>;
    dialogues?: Array<{ id: string }>;
  }>({
    providerId: target?.providerId,
    model: target?.model,
    sessionId: `studio-ui-${bundle.slug}`,
    action: "generate-structure",
    systemPrompt,
    userPrompt,
  });

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
    model: usedModel,
    summary: raw.summary ?? "AI structure proposal",
    items,
  };
}

export async function reviewStoryLogic(
  bundle: GameDesignBundle,
  target?: AiTarget
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

  const { data: raw, model: usedModel } = await callAiJson<{
    findings: Array<{
      severity: "error" | "warning" | "suggestion";
      title: { cs: string; en: string };
      detail: { cs: string; en: string };
    }>;
  }>({
    providerId: target?.providerId,
    model: target?.model,
    sessionId: `studio-ui-${bundle.slug}`,
    action: "review-logic",
    systemPrompt,
    userPrompt: JSON.stringify(bundle),
  });

  return {
    model: usedModel,
    findings: raw.findings ?? [],
  };
}
