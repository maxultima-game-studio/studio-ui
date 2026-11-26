import { useEffect, useState } from "react";
import {
  Lock,
  Unlock,
  Sparkles,
  Save,
  Plus,
  Trash2,
  ArrowRight,
  Wand2,
} from "lucide-react";
import type { Act, GameDesignBundle, WorldBible } from "@studio-ui/shared";
import { dict, type UiLocale } from "../i18n";
import { ClearableInput } from "./ClearableInput";

interface Props {
  bundle: GameDesignBundle;
  uiLocale: UiLocale;
  contentLocale: string;
  aiBusy: boolean;
  onSaveWorld: (world: WorldBible) => Promise<void>;
  onRefineAct: (actId: string, instruction: string) => Promise<boolean>;
  onGoToEntities: () => void;
}

export function StoryActsView({
  bundle,
  uiLocale,
  contentLocale,
  aiBusy,
  onSaveWorld,
  onRefineAct,
  onGoToEntities,
}: Props) {
  const t = dict[uiLocale];
  const isCs = uiLocale === "cs";
  const [world, setWorld] = useState<WorldBible>(bundle.world);
  const [actPrompts, setActPrompts] = useState<Record<string, string>>({});

  useEffect(() => {
    setWorld(bundle.world);
  }, [bundle.slug, bundle.world]);

  const handleAddAct = async () => {
    const idx = world.acts.length + 1;
    const newAct: Act = {
      id: `act-${idx}`,
      locked: false,
      title: { cs: `Akt ${idx}: Nový akt`, en: `Act ${idx}: New Act` },
      summary: { cs: "", en: "" },
    };
    const next = { ...world, acts: [...world.acts, newAct] };
    setWorld(next);
    await onSaveWorld(next);
  };

  const handleDeleteAct = async (actId: string) => {
    const next = { ...world, acts: world.acts.filter((a) => a.id !== actId) };
    setWorld(next);
    await onSaveWorld(next);
  };

  const handleRunActAi = async (actId: string) => {
    const instruction = actPrompts[actId] ?? "";
    const ok = await onRefineAct(actId, instruction);
    if (ok) {
      setActPrompts((prev) => ({ ...prev, [actId]: "" }));
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {isCs ? "Příběh & Akty (od začátku do konce)" : "Story Arc & Acts (Start to Finish)"}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {isCs
              ? "Uprav svět a jednotlivé akty do konzistentní příběhové osnovy. Každý akt můžeš samostatně doladit pomocí AI."
              : "Shape the world and each act into a cohesive narrative arc. Refine any individual act with AI."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void onSaveWorld(world)}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <Save className="h-3.5 w-3.5" />
            {t.save}
          </button>
          <button
            onClick={() => void handleAddAct()}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <Plus className="h-3.5 w-3.5" />
            {isCs ? "Přidat akt" : "Add Act"}
          </button>
          <button
            onClick={onGoToEntities}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            {isCs ? "Krok 3: Detaily aktů" : "Step 3: Act Details"}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* World Setting & Visual Direction (spacious, readable) */}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-xs dark:border-zinc-800/90 dark:bg-[#15181e]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {isCs
              ? `Svět & atmosféra (${contentLocale.toUpperCase()})`
              : `World & Atmosphere (${contentLocale.toUpperCase()})`}
          </h3>
          <button
            onClick={() => setWorld({ ...world, locked: !world.locked })}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              world.locked
                ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {world.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {world.locked ? t.locked : t.unlocked}
          </button>
        </div>

        <textarea
          rows={4}
          value={world.setting[contentLocale] ?? ""}
          onChange={(e) =>
            setWorld({
              ...world,
              setting: { ...world.setting, [contentLocale]: e.target.value },
            })
          }
          placeholder={isCs ? "Popis světa, atmosféry a pravidel…" : "World setting, atmosphere, and rules…"}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 text-sm leading-relaxed text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100"
        />

        <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {isCs ? "Vizuální směr (Visual Style Brief)" : "Visual Style Brief"}
          <textarea
            rows={2}
            value={world.visual_style}
            onChange={(e) => setWorld({ ...world, visual_style: e.target.value })}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm leading-relaxed text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100"
          />
        </label>
      </section>

      {/* Acts Storyline (Full-width readable cards) */}
      <section className="flex flex-col gap-5">
        {world.acts.map((act, idx) => (
          <article
            key={act.id}
            className="flex flex-col gap-3.5 rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-xs dark:border-zinc-800/90 dark:bg-[#15181e]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 font-mono text-xs font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                  {idx + 1}
                </span>
                <span className="font-mono text-xs text-zinc-400">{act.id}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const next = [...world.acts];
                    next[idx] = { ...act, locked: !act.locked };
                    setWorld({ ...world, acts: next });
                  }}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${
                    act.locked
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {act.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {act.locked ? t.locked : t.unlocked}
                </button>
                <button
                  onClick={() => void handleDeleteAct(act.id)}
                  title={t.delete}
                  className="rounded-full p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <ClearableInput
              value={act.title[contentLocale] ?? ""}
              onChange={(val) => {
                const next = [...world.acts];
                next[idx] = {
                  ...act,
                  title: { ...act.title, [contentLocale]: val },
                };
                setWorld({ ...world, acts: next });
              }}
              placeholder={isCs ? "Název aktu…" : "Act title…"}
              className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2 text-base font-semibold text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100"
            />

            <textarea
              rows={6}
              value={act.summary[contentLocale] ?? ""}
              onChange={(e) => {
                const next = [...world.acts];
                next[idx] = {
                  ...act,
                  summary: { ...act.summary, [contentLocale]: e.target.value },
                };
                setWorld({ ...world, acts: next });
              }}
              placeholder={
                isCs
                  ? "Detailní průběh aktu: jak začíná, klíčová setkání, zvrat a vyústění do dalšího aktu…"
                  : "Detailed act storyline: opening, key encounters, turning point, and transition to next act…"
              }
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 text-sm leading-relaxed text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100"
            />

            {/* Per-Act AI Refinement Bar */}
            <div className="flex flex-col gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-2.5 sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex-1">
                <ClearableInput
                  value={actPrompts[act.id] ?? ""}
                  onChange={(val) =>
                    setActPrompts((prev) => ({ ...prev, [act.id]: val }))
                  }
                  placeholder={
                    isCs
                      ? "Instrukce pro AI k tomuto aktu (např. „přidej silnější zvrat na konci“ nebo nech prázdné pro obecné vylepšení)…"
                      : "AI instruction for this act (e.g. 'add a stronger twist at the end' or leave empty to polish)…"
                  }
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <button
                onClick={() => void handleRunActAi(act.id)}
                disabled={aiBusy || act.locked}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-800 transition hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-blue-500 dark:hover:text-blue-400"
              >
                {aiBusy ? (
                  <Sparkles className="h-3.5 w-3.5 animate-pulse text-blue-500" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5 text-blue-500" />
                )}
                {aiBusy
                  ? t.aiWorking
                  : isCs
                  ? "AI: Doladit tento akt"
                  : "AI: Refine this act"}
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
