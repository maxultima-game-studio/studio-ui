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
    actCount: number;
    message: string;
    history: Array<{ role: "user" | "assistant"; text: string }>;
    locale: string;
    providerId?: string;
    model?: string;
  }
): Promise<{
  model: string;
  reply: string;
  suggestedActCount: number;
  storyPlan: string;
}> {
  const systemPrompt = `You are a narrative producer helping a game designer plan how to expand a game pitch into structured Acts before generating Step 2.
Have a focused, helpful planning conversation: recommend the right number of acts (1–6), pacing, key story beats per act, and scope.
Return ONLY valid JSON:
{
  "reply": "Short, direct conversational response to the user's message (2–4 sentences)",
  "suggestedActCount": 3,
  "storyPlan": "Updated clean Markdown planning brief describing the scope, number of acts, and bullet-point direction for each act (ready to guide Step 2 generation)"
}
Write in language "${params.locale}".`;

  const historyText = params.history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.text}`)
    .join("\n");

  const userPrompt = `Game settings: ${JSON.stringify(bundle.game)}
Pitch:
${params.currentPitch}

Current act count preference: ${params.actCount}
Current story plan brief:
${params.currentPlan || "(empty yet)"}

Recent planning conversation:
${historyText || "(first message)"}

Latest user message:
${params.message || "Navrhni optimální počet aktů a osnovu rozpracování této nosné myšlenky."}`;

  const { data, model } = await callAiJson<{
    reply: string;
    suggestedActCount?: number;
    storyPlan?: string;
  }>({
    providerId: params.providerId,
    model: params.model,
    sessionId: `studio-ui-${bundle.slug}`,
    action: "story:plan",
    systemPrompt,
    userPrompt,
  });

  const count = Number(data.suggestedActCount);
  return {
    model,
    reply: data.reply ?? "",
    suggestedActCount:
      Number.isFinite(count) && count >= 1 && count <= 8 ? Math.round(count) : params.actCount,
    storyPlan: data.storyPlan ?? params.currentPlan,
  };
}

/**
 * Step 1 -> Step 2: Expand Pitch + Story Plan into a full, consistent multi-act Story Arc.
 */
export async function expandPitchToStory(
  bundle: GameDesignBundle,
  target?: AiTarget & { actCount?: number; storyPlan?: string }
): Promise<{ model: string; summary: string; world: WorldBible }> {
  const locales = bundle.game.locales.join(", ");
  const actCount = Math.min(8, Math.max(1, Number(target?.actCount ?? 3) || 3));
  const storyPlan = (target?.storyPlan ?? bundle.story_plan ?? "").trim();

  const systemPrompt = `You are a lead narrative designer for 2D point-and-click adventure games.
Expand the pitch and planning brief into a complete, cohesive story from beginning to end split into EXACTLY ${actCount} rich, readable Acts.
Return ONLY valid JSON:
{
  "summary": "1-sentence overview of the full story arc",
  "world": {
    "locked": false,
    "setting": { "cs": "Rich 2-4 sentence description of world, atmosphere, and rules", "en": "..." },
    "visual_style": "Detailed art direction and palette brief",
    "themes": ["theme-1", "theme-2", "theme-3"],
    "acts": [
      {
        "id": "act-1",
        "locked": false,
        "title": { "cs": "Akt I: ...", "en": "Act I: ..." },
        "summary": { "cs": "Detailed 4-6 sentence narrative beat sheet for this act: setup, key encounters, turning point, and cliffhanger/resolution.", "en": "..." }
      }
    ]
  }
}
You MUST generate exactly ${actCount} acts (act-1 .. act-${actCount}). All IDs MUST be lowercase kebab-case. Fill ALL locales: ${locales}.`;

  const userPrompt = `Game settings: ${JSON.stringify(bundle.game)}
Pitch:
${bundle.pitch}

Approved Story Plan & Scope (follow this closely):
${storyPlan || `Create ${actCount} balanced, cohesive acts from opening to finale.`}

Generate the full World and all ${actCount} Acts.`;

  const { data, model } = await callAiJson<{
    summary: string;
    world: WorldBible;
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
    summary: data.summary ?? "Story arc generated",
    world: data.world,
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
  const targetAct = bundle.world.acts.find((a) => a.id === params.actId);
  if (!targetAct) throw new Error(`Act "${params.actId}" not found`);

  const systemPrompt = `You are a lead narrative designer refining one act of a point-and-click adventure story while keeping strict continuity with the pitch and all other acts.
Return ONLY valid JSON:
{
  "rationale": "1-2 short sentences explaining the changes",
  "act": {
    "id": "${params.actId}",
    "locked": ${Boolean(targetAct.locked)},
    "title": { "cs": "...", "en": "..." },
    "summary": { "cs": "Rich 4-6 sentence act story...", "en": "..." }
  }
}
Keep ID "${params.actId}" unchanged. Fill ALL locales: ${locales}.`;

  const userPrompt = `Pitch:
${bundle.pitch}

Full story acts for continuity:
${JSON.stringify(bundle.world.acts, null, 2)}

Target act to refine: ${params.actId}
User instruction:
${params.instruction || "Deepen the pacing, mystery, and emotional hook while keeping continuity with neighboring acts."}`;

  const { data, model } = await callAiJson<{
    rationale: string;
    act: Act;
  }>({
    providerId: params.providerId,
    model: params.model,
    sessionId: `studio-ui-${bundle.slug}`,
    action: `act:refine:${params.actId}`,
    systemPrompt,
    userPrompt,
  });

  return {
    model,
    act: { ...data.act, id: params.actId },
    rationale: data.rationale ?? "",
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
