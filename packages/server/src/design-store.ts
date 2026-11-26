import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import {
  CharacterSchema,
  DialogueSchema,
  FlagsFileSchema,
  GameConfigSchema,
  ItemSchema,
  PuzzleSchema,
  SceneSchema,
  WorldBibleSchema,
  type Character,
  type Dialogue,
  type FlagsFile,
  type GameConfig,
  type GameDesignBundle,
  type Item,
  type ProposalItem,
  type Puzzle,
  type Scene,
  type WorldBible,
} from "@studio-ui/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// studio-ui/packages/server/src -> studio-ui/.. (maxultima-game-studio)
const DEFAULT_GAMES_ROOT = path.resolve(__dirname, "../../../..");

export interface DiscoveredGame {
  slug: string;
  path: string;
  hasDesign: boolean;
}

function getCliGameArg(): string | undefined {
  const idx = process.argv.indexOf("--game");
  if (idx !== -1 && process.argv[idx + 1]) {
    return path.resolve(process.argv[idx + 1]);
  }
  return undefined;
}

export function getGamesRoot(): string {
  return process.env.STUDIO_GAMES_ROOT
    ? path.resolve(process.env.STUDIO_GAMES_ROOT)
    : DEFAULT_GAMES_ROOT;
}

export async function discoverGames(): Promise<DiscoveredGame[]> {
  const explicitGameDir = getCliGameArg() ?? process.env.GAME_DIR;
  const results: DiscoveredGame[] = [];
  const seen = new Set<string>();

  if (explicitGameDir) {
    const resolved = path.resolve(explicitGameDir);
    const slug = path.basename(resolved);
    const hasDesign = await exists(path.join(resolved, "design"));
    results.push({ slug, path: resolved, hasDesign });
    seen.add(slug);
  }

  const root = getGamesRoot();
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith("game-")) continue;
      if (seen.has(entry.name)) continue;
      const fullPath = path.join(root, entry.name);
      const hasDesign = await exists(path.join(fullPath, "design"));
      results.push({ slug: entry.name, path: fullPath, hasDesign });
      seen.add(entry.name);
    }
  } catch {
    // Root directory unreadable; return whatever explicit game was found.
  }

  return results.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function resolveGameDir(slug: string): Promise<string> {
  const games = await discoverGames();
  const found = games.find((g) => g.slug === slug);
  if (!found) {
    throw new Error(`Game repository "${slug}" not found`);
  }
  return found.path;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readYamlFile<T>(filePath: string, fallback: T): Promise<T> {
  if (!(await exists(filePath))) return fallback;
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = YAML.parse(raw);
  return (parsed ?? fallback) as T;
}

async function writeYamlAtomic(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const content = YAML.stringify(data, { lineWidth: 100 });
  const tmpPath = `${filePath}.tmp-${Date.now()}`;
  await fs.writeFile(tmpPath, content, "utf8");
  await fs.rename(tmpPath, filePath);
}

async function readEntityDir<T>(
  dirPath: string,
  parse: (data: unknown) => T
): Promise<T[]> {
  if (!(await exists(dirPath))) return [];
  const files = (await fs.readdir(dirPath))
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();
  const items: T[] = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(dirPath, file), "utf8");
    const parsed = YAML.parse(raw);
    if (parsed) {
      items.push(parse(parsed));
    }
  }
  return items;
}

export async function loadGameDesign(slug: string): Promise<GameDesignBundle> {
  const gameDir = await resolveGameDir(slug);
  const designDir = path.join(gameDir, "design");

  const defaultId = slug.replace(/^game-/, "") || "untitled";
  const rawGame = await readYamlFile(path.join(designDir, "game.yaml"), {
    id: defaultId,
    title: { cs: slug, en: slug },
    default_locale: "cs",
    locales: ["cs", "en"],
    genre: "point-and-click",
    style: "pixel-art",
    target_resolution: "640x360",
  });
  const game = GameConfigSchema.parse(rawGame);

  const pitchPath = path.join(designDir, "pitch.md");
  const pitch = (await exists(pitchPath))
    ? await fs.readFile(pitchPath, "utf8")
    : "";

  const storyPlanPath = path.join(designDir, "story-plan.md");
  const story_plan = (await exists(storyPlanPath))
    ? await fs.readFile(storyPlanPath, "utf8")
    : "";

  const rawWorld = await readYamlFile(path.join(designDir, "world.yaml"), {});
  const world = WorldBibleSchema.parse(rawWorld);

  const rawFlags = await readYamlFile(path.join(designDir, "flags.yaml"), {
    flags: [],
  });
  const flags = FlagsFileSchema.parse(rawFlags);

  const [characters, items, scenes, puzzles, dialogues] = await Promise.all([
    readEntityDir(path.join(designDir, "characters"), (d) =>
      CharacterSchema.parse(d)
    ),
    readEntityDir(path.join(designDir, "items"), (d) => ItemSchema.parse(d)),
    readEntityDir(path.join(designDir, "scenes"), (d) => SceneSchema.parse(d)),
    readEntityDir(path.join(designDir, "puzzles"), (d) =>
      PuzzleSchema.parse(d)
    ),
    readEntityDir(path.join(designDir, "dialogues"), (d) =>
      DialogueSchema.parse(d)
    ),
  ]);

  return {
    slug,
    game,
    pitch,
    story_plan,
    world,
    flags,
    characters,
    items,
    scenes,
    puzzles,
    dialogues,
  };
}

export async function saveGameConfig(
  slug: string,
  config: GameConfig
): Promise<GameConfig> {
  const parsed = GameConfigSchema.parse(config);
  const gameDir = await resolveGameDir(slug);
  await writeYamlAtomic(path.join(gameDir, "design", "game.yaml"), parsed);
  return parsed;
}

export async function savePitch(slug: string, pitch: string): Promise<void> {
  const gameDir = await resolveGameDir(slug);
  const pitchPath = path.join(gameDir, "design", "pitch.md");
  await fs.mkdir(path.dirname(pitchPath), { recursive: true });
  await fs.writeFile(pitchPath, pitch, "utf8");
}

export async function saveStoryPlan(
  slug: string,
  storyPlan: string
): Promise<void> {
  const gameDir = await resolveGameDir(slug);
  const planPath = path.join(gameDir, "design", "story-plan.md");
  await fs.mkdir(path.dirname(planPath), { recursive: true });
  await fs.writeFile(planPath, storyPlan, "utf8");
}

export async function saveWorld(
  slug: string,
  world: WorldBible
): Promise<WorldBible> {
  const parsed = WorldBibleSchema.parse(world);
  const gameDir = await resolveGameDir(slug);
  await writeYamlAtomic(path.join(gameDir, "design", "world.yaml"), parsed);
  return parsed;
}

export async function saveFlags(
  slug: string,
  flags: FlagsFile
): Promise<FlagsFile> {
  const parsed = FlagsFileSchema.parse(flags);
  const gameDir = await resolveGameDir(slug);
  await writeYamlAtomic(path.join(gameDir, "design", "flags.yaml"), parsed);
  return parsed;
}

export type CollectionKind =
  | "characters"
  | "items"
  | "scenes"
  | "puzzles"
  | "dialogues";

export async function saveEntity(
  slug: string,
  kind: CollectionKind,
  data: unknown
): Promise<Character | Item | Scene | Puzzle | Dialogue> {
  const gameDir = await resolveGameDir(slug);
  let parsed: Character | Item | Scene | Puzzle | Dialogue;
  switch (kind) {
    case "characters":
      parsed = CharacterSchema.parse(data);
      break;
    case "items":
      parsed = ItemSchema.parse(data);
      break;
    case "scenes":
      parsed = SceneSchema.parse(data);
      break;
    case "puzzles":
      parsed = PuzzleSchema.parse(data);
      break;
    case "dialogues":
      parsed = DialogueSchema.parse(data);
      break;
  }
  const filePath = path.join(gameDir, "design", kind, `${parsed.id}.yaml`);
  await writeYamlAtomic(filePath, parsed);
  return parsed;
}

export async function deleteEntity(
  slug: string,
  kind: CollectionKind,
  id: string
): Promise<void> {
  const gameDir = await resolveGameDir(slug);
  const filePath = path.join(gameDir, "design", kind, `${id}.yaml`);
  await fs.rm(filePath, { force: true });
}

export async function applyProposalItems(
  slug: string,
  items: ProposalItem[]
): Promise<{ applied: string[]; skippedLocked: string[] }> {
  const current = await loadGameDesign(slug);
  const applied: string[] = [];
  const skippedLocked: string[] = [];

  for (const item of items) {
    if (item.entity_type === "world") {
      if (current.world.locked) {
        skippedLocked.push(item.key);
        continue;
      }
      await saveWorld(slug, WorldBibleSchema.parse(item.data));
      applied.push(item.key);
      continue;
    }

    if (item.entity_type === "flag") {
      const nextFlags = FlagsFileSchema.parse({
        flags: [
          ...current.flags.flags.filter((f) => f.id !== item.entity_id),
          item.data,
        ],
      });
      current.flags = nextFlags;
      await saveFlags(slug, nextFlags);
      applied.push(item.key);
      continue;
    }

    const kindMap = {
      character: "characters",
      item: "items",
      scene: "scenes",
      puzzle: "puzzles",
      dialogue: "dialogues",
    } as const;
    const kind = kindMap[item.entity_type];
    const existingList = current[kind] as Array<{ id: string; locked?: boolean }>;
    const existing = existingList.find((e) => e.id === item.entity_id);
    if (existing?.locked) {
      skippedLocked.push(item.key);
      continue;
    }
    await saveEntity(slug, kind, item.data);
    applied.push(item.key);
  }

  return { applied, skippedLocked };
}

export async function resetAndApplyPhaseProposal(
  slug: string,
  clearCollections: CollectionKind[],
  clearFlags: boolean,
  items: ProposalItem[]
): Promise<{ applied: string[]; skippedLocked: string[]; removedCount: number }> {
  const current = await loadGameDesign(slug);
  let removedCount = 0;

  for (const kind of clearCollections) {
    const list = current[kind] as Array<{ id: string; locked?: boolean }>;
    for (const entity of list) {
      if (!entity.locked) {
        await deleteEntity(slug, kind, entity.id);
        removedCount++;
      }
    }
  }

  if (clearFlags) {
    await saveFlags(slug, { flags: [] });
  }

  const res = await applyProposalItems(slug, items);

  // Keep game.start_scene_id consistent with remaining/new scenes
  const updated = await loadGameDesign(slug);
  const sceneIds = new Set(updated.scenes.map((s) => s.id));
  if (
    updated.game.start_scene_id &&
    !sceneIds.has(updated.game.start_scene_id)
  ) {
    await saveGameConfig(slug, {
      ...updated.game,
      start_scene_id: updated.scenes[0]?.id,
    });
  } else if (!updated.game.start_scene_id && updated.scenes[0]) {
    await saveGameConfig(slug, {
      ...updated.game,
      start_scene_id: updated.scenes[0].id,
    });
  }

  return { ...res, removedCount };
}
