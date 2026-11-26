import { useEffect, useState } from "react";
import {
  Lock,
  Unlock,
  Sparkles,
  Play,
  Wand2,
  Users,
  Package,
  Puzzle as PuzzleIcon,
  Flag,
} from "lucide-react";
import type {
  Character,
  FlagsFile,
  GameDesignBundle,
  Item,
  PipelineSlotStatus,
  Puzzle,
} from "@studio-ui/shared";
import { dict, type UiLocale } from "../i18n";
import { ClearableInput } from "./ClearableInput";

interface Props {
  bundle: GameDesignBundle;
  pipeline: Record<string, PipelineSlotStatus>;
  uiLocale: UiLocale;
  contentLocale: string;
  aiBusy: boolean;
  onSaveCharacter: (ch: Character) => Promise<void>;
  onSaveItem: (it: Item) => Promise<void>;
  onSavePuzzle: (pz: Puzzle) => Promise<void>;
  onSaveFlags: (flags: FlagsFile) => Promise<void>;
  onGenerateActEntities: (actId: string) => Promise<void>;
  onRefineEntity: (
    kind: "characters" | "items" | "puzzles",
    entityId: string,
    instruction: string
  ) => Promise<boolean>;
  onAiGenerateStructure: () => Promise<void>;
  onTriggerPipeline: (slotId: string) => Promise<void>;
}

export function ActDetailsView({
  bundle,
  pipeline,
  uiLocale,
  contentLocale,
  aiBusy,
  onSaveCharacter,
  onSaveItem,
  onSavePuzzle,
  onGenerateActEntities,
  onRefineEntity,
  onAiGenerateStructure,
  onTriggerPipeline,
}: Props) {
  const t = dict[uiLocale];
  const isCs = uiLocale === "cs";

  const [selectedActId, setSelectedActId] = useState<string>(
    bundle.world.acts[0]?.id ?? "all"
  );
  const [entityPrompts, setEntityPrompts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (
      selectedActId !== "all" &&
      !bundle.world.acts.some((a) => a.id === selectedActId)
    ) {
      setSelectedActId(bundle.world.acts[0]?.id ?? "all");
    }
  }, [bundle.world.acts, selectedActId]);

  const activeAct = bundle.world.acts.find((a) => a.id === selectedActId) ?? null;

  const visibleChars =
    selectedActId === "all"
      ? bundle.characters
      : bundle.characters.filter(
          (c) => !c.acts || c.acts.length === 0 || c.acts.includes(selectedActId)
        );

  const visibleItems =
    selectedActId === "all"
      ? bundle.items
      : bundle.items.filter((i) => !i.act || i.act === selectedActId);

  const visiblePuzzles =
    selectedActId === "all"
      ? bundle.puzzles
      : bundle.puzzles.filter((p) => !p.act || p.act === selectedActId);

  const runEntityAi = async (
    kind: "characters" | "items" | "puzzles",
    entityId: string
  ) => {
    const key = `${kind}:${entityId}`;
    const ok = await onRefineEntity(kind, entityId, entityPrompts[key] ?? "");
    if (ok) {
      setEntityPrompts((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const cardCls =
    "flex flex-col gap-3 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-xs dark:border-zinc-800/90 dark:bg-[#15181e]";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      {/* Top Bar: Act Selector + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {bundle.world.acts.map((act, idx) => (
            <button
              key={act.id}
              onClick={() => setSelectedActId(act.id)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                selectedActId === act.id
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
            >
              {idx + 1}. {act.title[contentLocale] ?? act.id}
            </button>
          ))}
          <button
            onClick={() => setSelectedActId("all")}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              selectedActId === "all"
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            {isCs ? "Všechny akty" : "All Acts"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {activeAct && (
            <button
              onClick={() => void onGenerateActEntities(activeAct.id)}
              disabled={aiBusy}
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiBusy
                ? t.aiWorking
                : isCs
                ? "AI: Vygenerovat entity pro tento akt"
                : "AI: Generate entities for this act"}
            </button>
          )}
          <button
            onClick={() => void onAiGenerateStructure()}
            disabled={aiBusy}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {aiBusy ? t.aiWorking : t.aiGenerateStructure}
          </button>
        </div>
      </div>

      {/* Selected Act Story Context Banner */}
      {activeAct && (
        <div className="rounded-2xl border border-zinc-200/90 bg-white px-5 py-4 shadow-xs dark:border-zinc-800/90 dark:bg-[#15181e]">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <span className="font-mono">{activeAct.id}</span>
            <span>—</span>
            <span>{activeAct.title[contentLocale] ?? activeAct.id}</span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {activeAct.summary[contentLocale] ?? ""}
          </p>
        </div>
      )}

      {/* Characters */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <Users className="h-4 w-4 text-blue-500" />
          {t.charactersTitle} ({visibleChars.length})
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleChars.map((ch) => {
            const pKey = `characters:${ch.id}`;
            return (
              <div key={ch.id} className={cardCls}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                      {ch.id}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {ch.role}
                    </span>
                  </div>
                  <button
                    onClick={() => void onSaveCharacter({ ...ch, locked: !ch.locked })}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${
                      ch.locked
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {ch.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    {ch.locked ? t.locked : t.unlocked}
                  </button>
                </div>

                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {ch.name[contentLocale] ?? ch.id}
                </div>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {ch.bio[contentLocale] ?? ""}
                </p>
                {ch.visual_brief && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    <strong className="text-zinc-700 dark:text-zinc-300">Visual:</strong>{" "}
                    {ch.visual_brief}
                  </p>
                )}

                {ch.asset_slots.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {ch.asset_slots.map((slot) => (
                      <button
                        key={slot.slot_id}
                        onClick={() => void onTriggerPipeline(slot.slot_id)}
                        className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] text-zinc-700 hover:border-blue-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                      >
                        <Play className="h-2.5 w-2.5 text-blue-500" />
                        {slot.slot_id} ({pipeline[slot.slot_id]?.status ?? "unlinked"})
                      </button>
                    ))}
                  </div>
                )}

                {/* Per-entity AI refine bar */}
                <div className="mt-1 flex items-center gap-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <ClearableInput
                    value={entityPrompts[pKey] ?? ""}
                    onChange={(v) =>
                      setEntityPrompts((prev) => ({ ...prev, [pKey]: v }))
                    }
                    placeholder={
                      isCs ? "AI: upravit nebo předělat postavu…" : "AI: refine or redefine character…"
                    }
                    className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-2.5 py-1.5 text-xs text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <button
                    onClick={() => void runEntityAi("characters", ch.id)}
                    disabled={aiBusy || ch.locked}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    <Wand2 className="h-3 w-3 text-blue-500" />
                    AI
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Items & Puzzles */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Items */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <Package className="h-4 w-4 text-emerald-500" />
            {t.itemsTitle} ({visibleItems.length})
          </h3>
          {visibleItems.map((item) => {
            const pKey = `items:${item.id}`;
            return (
              <div key={item.id} className={cardCls}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                    {item.id}
                  </span>
                  <button
                    onClick={() => void onSaveItem({ ...item, locked: !item.locked })}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${
                      item.locked
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {item.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    {item.locked ? t.locked : t.unlocked}
                  </button>
                </div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {item.name[contentLocale] ?? item.id}
                </div>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {item.description[contentLocale] ?? ""}
                </p>

                <div className="mt-1 flex items-center gap-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <ClearableInput
                    value={entityPrompts[pKey] ?? ""}
                    onChange={(v) =>
                      setEntityPrompts((prev) => ({ ...prev, [pKey]: v }))
                    }
                    placeholder={
                      isCs ? "AI: upravit nebo předělat předmět…" : "AI: refine or redefine item…"
                    }
                    className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-2.5 py-1.5 text-xs text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <button
                    onClick={() => void runEntityAi("items", item.id)}
                    disabled={aiBusy || item.locked}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    <Wand2 className="h-3 w-3 text-blue-500" />
                    AI
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        {/* Puzzles */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <PuzzleIcon className="h-4 w-4 text-amber-500" />
            {t.puzzles} ({visiblePuzzles.length})
          </h3>
          {visiblePuzzles.map((pz) => {
            const pKey = `puzzles:${pz.id}`;
            return (
              <div key={pz.id} className={cardCls}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-amber-600 dark:text-amber-400">
                    {pz.id}
                  </span>
                  <button
                    onClick={() => void onSavePuzzle({ ...pz, locked: !pz.locked })}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${
                      pz.locked
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {pz.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    {pz.locked ? t.locked : t.unlocked}
                  </button>
                </div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {pz.title[contentLocale] ?? pz.id}
                </div>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {pz.summary[contentLocale] ?? ""}
                </p>

                {(pz.requires.length > 0 || pz.effects.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    {pz.requires.map((r, i) => (
                      <span
                        key={`r-${i}`}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        req: {r.type}={r.ref}
                      </span>
                    ))}
                    {pz.effects.map((e, i) => (
                      <span
                        key={`e-${i}`}
                        className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                      >
                        eff: {e.type}={e.ref}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-1 flex items-center gap-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <ClearableInput
                    value={entityPrompts[pKey] ?? ""}
                    onChange={(v) =>
                      setEntityPrompts((prev) => ({ ...prev, [pKey]: v }))
                    }
                    placeholder={
                      isCs ? "AI: upravit nebo předělat puzzle…" : "AI: refine or redefine puzzle…"
                    }
                    className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-2.5 py-1.5 text-xs text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <button
                    onClick={() => void runEntityAi("puzzles", pz.id)}
                    disabled={aiBusy || pz.locked}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    <Wand2 className="h-3 w-3 text-blue-500" />
                    AI
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {/* Flags summary */}
      {bundle.flags.flags.length > 0 && (
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-xs dark:border-zinc-800/90 dark:bg-[#15181e]">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <Flag className="h-4 w-4 text-zinc-400" />
            {t.flagsTitle} ({bundle.flags.flags.length})
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {bundle.flags.flags.map((f) => (
              <div
                key={f.id}
                className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950/60"
              >
                <div className="font-mono text-[11px] text-amber-700 dark:text-amber-300">
                  {f.id}
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {f.description[contentLocale] ?? ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
