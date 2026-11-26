import { z } from "zod";

export const KebabIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be lowercase kebab-case");

export const LocalizedTextSchema = z.record(z.string(), z.string());
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const ConditionSchema = z.object({
  type: z.enum(["flag", "item", "dialogue_seen"]),
  ref: z.string().min(1),
  value: z.union([z.boolean(), z.string(), z.number()]).optional(),
});
export type Condition = z.infer<typeof ConditionSchema>;

export const EffectSchema = z.object({
  type: z.enum(["set_flag", "give_item", "remove_item", "unlock_exit"]),
  ref: z.string().min(1),
  value: z.union([z.boolean(), z.string(), z.number()]).optional(),
});
export type Effect = z.infer<typeof EffectSchema>;

export const AssetSlotSchema = z.object({
  slot_id: KebabIdSchema,
  kind: z.enum([
    "background",
    "foreground",
    "walkmask",
    "ambient_audio",
    "portrait",
    "animation",
    "icon",
    "world_sprite",
  ]),
  animation_name: z.string().optional(),
  brief: z.string().default(""),
});
export type AssetSlot = z.infer<typeof AssetSlotSchema>;

export const GameConfigSchema = z.object({
  id: KebabIdSchema,
  title: LocalizedTextSchema,
  default_locale: z.string().default("cs"),
  locales: z.array(z.string()).min(1).default(["cs", "en"]),
  genre: z.string().default("point-and-click"),
  style: z.string().default("pixel-art"),
  target_resolution: z.string().default("640x360"),
  start_scene_id: z.string().optional(),
});
export type GameConfig = z.infer<typeof GameConfigSchema>;

export const ActSchema = z.object({
  id: KebabIdSchema,
  title: LocalizedTextSchema,
  summary: LocalizedTextSchema.default({}),
});

export const WorldBibleSchema = z.object({
  locked: z.boolean().default(false),
  setting: LocalizedTextSchema.default({}),
  visual_style: z.string().default(""),
  themes: z.array(z.string()).default([]),
  acts: z.array(ActSchema).default([]),
});
export type WorldBible = z.infer<typeof WorldBibleSchema>;

export const FlagDefSchema = z.object({
  id: KebabIdSchema,
  description: LocalizedTextSchema.default({}),
  initial_value: z.boolean().default(false),
});
export type FlagDef = z.infer<typeof FlagDefSchema>;

export const FlagsFileSchema = z.object({
  flags: z.array(FlagDefSchema).default([]),
});
export type FlagsFile = z.infer<typeof FlagsFileSchema>;

export const CharacterSchema = z.object({
  id: KebabIdSchema,
  locked: z.boolean().default(false),
  name: LocalizedTextSchema,
  role: z.enum(["protagonist", "npc", "antagonist"]).default("npc"),
  bio: LocalizedTextSchema.default({}),
  voice_notes: z.string().default(""),
  visual_brief: z.string().default(""),
  asset_slots: z.array(AssetSlotSchema).default([]),
});
export type Character = z.infer<typeof CharacterSchema>;

export const ItemSchema = z.object({
  id: KebabIdSchema,
  locked: z.boolean().default(false),
  name: LocalizedTextSchema,
  description: LocalizedTextSchema.default({}),
  visual_brief: z.string().default(""),
  combinable_with: z.array(z.string()).optional(),
  asset_slots: z.array(AssetSlotSchema).default([]),
});
export type Item = z.infer<typeof ItemSchema>;

export const SceneExitSchema = z.object({
  id: KebabIdSchema,
  target_scene_id: KebabIdSchema,
  label: LocalizedTextSchema,
  condition: ConditionSchema.optional(),
});
export type SceneExit = z.infer<typeof SceneExitSchema>;

export const HotspotSchema = z.object({
  id: KebabIdSchema,
  label: LocalizedTextSchema,
  description: LocalizedTextSchema.default({}),
  item_id: z.string().optional(),
  dialogue_id: z.string().optional(),
  puzzle_id: z.string().optional(),
});
export type Hotspot = z.infer<typeof HotspotSchema>;

export const SceneSchema = z.object({
  id: KebabIdSchema,
  locked: z.boolean().default(false),
  act: z.string().optional(),
  title: LocalizedTextSchema,
  description: LocalizedTextSchema.default({}),
  visual_brief: z.string().default(""),
  graph_position: PositionSchema.default({ x: 100, y: 100 }),
  characters: z.array(z.string()).default([]),
  exits: z.array(SceneExitSchema).default([]),
  hotspots: z.array(HotspotSchema).default([]),
  asset_slots: z.array(AssetSlotSchema).default([]),
});
export type Scene = z.infer<typeof SceneSchema>;

export const PuzzleSchema = z.object({
  id: KebabIdSchema,
  locked: z.boolean().default(false),
  scene_id: z.string(),
  title: LocalizedTextSchema,
  summary: LocalizedTextSchema.default({}),
  requires: z.array(ConditionSchema).default([]),
  effects: z.array(EffectSchema).default([]),
});
export type Puzzle = z.infer<typeof PuzzleSchema>;

export const DialogueChoiceSchema = z.object({
  id: KebabIdSchema,
  text: LocalizedTextSchema,
  condition: ConditionSchema.optional(),
  effects: z.array(EffectSchema).optional(),
  next_node_id: z.string().optional(),
});
export type DialogueChoice = z.infer<typeof DialogueChoiceSchema>;

export const DialogueNodeSchema = z.object({
  id: KebabIdSchema,
  type: z.enum(["npc_line", "player_choice", "effect", "end"]),
  position: PositionSchema.default({ x: 100, y: 100 }),
  speaker_id: z.string().optional(),
  text: LocalizedTextSchema.optional(),
  condition: ConditionSchema.optional(),
  effects: z.array(EffectSchema).optional(),
  next_node_id: z.string().optional(),
  choices: z.array(DialogueChoiceSchema).optional(),
});
export type DialogueNode = z.infer<typeof DialogueNodeSchema>;

export const DialogueSchema = z.object({
  id: KebabIdSchema,
  locked: z.boolean().default(false),
  scene_id: z.string().optional(),
  character_id: z.string().optional(),
  title: LocalizedTextSchema,
  start_node_id: z.string(),
  nodes: z.record(z.string(), DialogueNodeSchema).default({}),
});
export type Dialogue = z.infer<typeof DialogueSchema>;

export const GameDesignBundleSchema = z.object({
  slug: z.string(),
  game: GameConfigSchema,
  pitch: z.string(),
  world: WorldBibleSchema,
  flags: FlagsFileSchema,
  characters: z.array(CharacterSchema),
  items: z.array(ItemSchema),
  scenes: z.array(SceneSchema),
  puzzles: z.array(PuzzleSchema),
  dialogues: z.array(DialogueSchema),
});
export type GameDesignBundle = z.infer<typeof GameDesignBundleSchema>;

export const PipelineSlotStatusSchema = z.object({
  slot_id: z.string(),
  status: z.enum([
    "unlinked",
    "todo",
    "generated",
    "in_review",
    "needs_fix",
    "approved",
  ]),
  preview_url: z.string().optional(),
  spec_path: z.string().optional(),
  message: z.string().optional(),
});
export type PipelineSlotStatus = z.infer<typeof PipelineSlotStatusSchema>;

export const ValidationIssueSchema = z.object({
  id: z.string(),
  severity: z.enum(["error", "warning"]),
  code: z.string(),
  entity_type: z.enum([
    "game",
    "world",
    "flag",
    "character",
    "item",
    "scene",
    "puzzle",
    "dialogue",
  ]),
  entity_id: z.string(),
  message: LocalizedTextSchema,
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const ProposalItemSchema = z.object({
  key: z.string(),
  entity_type: z.enum([
    "world",
    "flag",
    "character",
    "item",
    "scene",
    "puzzle",
    "dialogue",
  ]),
  entity_id: z.string(),
  action: z.enum(["create", "update"]),
  locked: z.boolean().default(false),
  summary: z.string(),
  data: z.unknown(),
});
export type ProposalItem = z.infer<typeof ProposalItemSchema>;

export const AiProposalSchema = z.object({
  kind: z.enum(["expand-pitch", "generate-structure", "translate-missing"]),
  model: z.string(),
  summary: z.string(),
  items: z.array(ProposalItemSchema),
});
export type AiProposal = z.infer<typeof AiProposalSchema>;
