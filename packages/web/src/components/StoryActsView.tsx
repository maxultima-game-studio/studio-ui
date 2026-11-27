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
  Edit3,
  Eye,
  Target,
  Palette,
  ListChecks,
  Puzzle,
  CornerDownRight,
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
  const [editingActs, setEditingActs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setWorld(bundle.world);
  }, [bundle.slug, bundle.world]);

  const updateAct = (idx: number, patch: Partial<Act>) => {
    const next = [...world.acts];
    next[idx] = { ...next[idx], ...patch };
    setWorld({ ...world, acts: next });
  };

  const handleAddAct = async () => {
    const idx = world.acts.length + 1;
    const id = `act-${idx}`;
    const newAct: Act = {
      id,
      locked: false,
      title: { cs: `Akt ${idx}: Nový akt`, en: `Act ${idx}: New Act` },
      goal: { cs: "", en: "" },
      visual_style: { cs: "", en: "" },
      summary: { cs: "", en: "" },
      beats: { cs: [], en: [] },
      puzzle_concepts: { cs: [], en: [] },
      transition: { cs: "", en: "" },
    };
    const next = { ...world, acts: [...world.acts, newAct] };
    setWorld(next);
    setEditingActs((prev) => ({ ...prev, [id]: true }));
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
      setEditingActs((prev) => ({ ...prev, [actId]: false }));
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {isCs
              ? "Příběh & Akty (od začátku do konce)"
              : "Story Arc & Acts (Start to Finish)"}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {isCs
              ? "Každý akt má vlastní cíl, vizuální směr, klíčové story beaty, koncepty puzzlů a přechod dál. Libovolný akt můžeš doladit přes AI."
              : "Each act has its own goal, visual direction, story beats, puzzle concepts, and transition. Refine any act with AI."}
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

      {/* Acts Storyline (Structured, full-width, no scrollbars) */}
      <section className="flex flex-col gap-5">
        {world.acts.map((act, idx) => {
          const isEditing = Boolean(editingActs[act.id]);
          const titleText = act.title[contentLocale] ?? act.id;
          const goalText = act.goal?.[contentLocale] ?? "";
          const visualText = act.visual_style?.[contentLocale] ?? "";
          const summaryText = act.summary?.[contentLocale] ?? "";
          const beatsList = act.beats?.[contentLocale] ?? [];
          const puzzlesList = act.puzzle_concepts?.[contentLocale] ?? [];
          const transitionText = act.transition?.[contentLocale] ?? "";

          return (
            <article
              key={act.id}
              className="flex flex-col gap-4 rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-xs dark:border-zinc-800/90 dark:bg-[#15181e]"
            >
              {/* Act Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 font-mono text-xs font-semibold text-white">
                    {idx + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                      {titleText}
                    </h3>
                    <span className="font-mono text-[11px] text-zinc-400">
                      {act.id}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingActs((prev) => ({
                        ...prev,
                        [act.id]: !prev[act.id],
                      }))
                    }
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    {isEditing ? (
                      <>
                        <Eye className="h-3 w-3" />
                        {isCs ? "Náhled" : "Preview"}
                      </>
                    ) : (
                      <>
                        <Edit3 className="h-3 w-3" />
                        {isCs ? "Upravit" : "Edit"}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => updateAct(idx, { locked: !act.locked })}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                      act.locked
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {act.locked ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      <Unlock className="h-3 w-3" />
                    )}
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

              {/* Structured Read View vs Edit Form */}
              {!isEditing ? (
                <div className="space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {summaryText && (
                    <p className="text-sm text-zinc-800 dark:text-zinc-200">
                      {summaryText}
                    </p>
                  )}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {goalText && (
                      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                        <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300">
                          <Target className="h-3.5 w-3.5" />
                          {isCs ? "Cíl aktu" : "Act Goal"}
                        </div>
                        <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                          {goalText}
                        </p>
                      </div>
                    )}

                    {visualText && (
                      <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3.5 dark:border-violet-900/40 dark:bg-violet-950/20">
                        <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-violet-800 dark:text-violet-300">
                          <Palette className="h-3.5 w-3.5" />
                          {isCs ? "Vizuální směr aktu" : "Act Visual Direction"}
                        </div>
                        <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                          {visualText}
                        </p>
                      </div>
                    )}
                  </div>

                  {beatsList.length > 0 && (
                    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        <ListChecks className="h-3.5 w-3.5 text-blue-500" />
                        {isCs ? "Story beaty" : "Story Beats"}
                      </div>
                      <ul className="space-y-1.5">
                        {beatsList.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {puzzlesList.length > 0 && (
                    <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/15">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                        <Puzzle className="h-3.5 w-3.5" />
                        {isCs ? "Koncepty puzzlů" : "Puzzle Concepts"}
                      </div>
                      <ul className="space-y-1.5">
                        {puzzlesList.map((p, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {transitionText && (
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/40 px-3.5 py-2.5 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
                      <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <span className="font-semibold">
                          {isCs ? "Přechod / zvrat: " : "Transition / Twist: "}
                        </span>
                        {transitionText}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3.5">
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {isCs ? "Název aktu" : "Act Title"}
                    <ClearableInput
                      value={titleText}
                      onChange={(val) =>
                        updateAct(idx, {
                          title: { ...act.title, [contentLocale]: val },
                        })
                      }
                      className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-sm font-semibold text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {isCs ? "Shrnutí děje aktu" : "Act Summary"}
                    <textarea
                      rows={3}
                      value={summaryText}
                      onChange={(e) =>
                        updateAct(idx, {
                          summary: {
                            ...act.summary,
                            [contentLocale]: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-sm leading-relaxed text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {isCs ? "Cíl aktu" : "Act Goal"}
                      <textarea
                        rows={3}
                        value={goalText}
                        onChange={(e) =>
                          updateAct(idx, {
                            goal: {
                              ...(act.goal ?? {}),
                              [contentLocale]: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-xs leading-relaxed text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {isCs ? "Vizuální směr aktu" : "Act Visual Direction"}
                      <textarea
                        rows={3}
                        value={visualText}
                        onChange={(e) =>
                          updateAct(idx, {
                            visual_style: {
                              ...(act.visual_style ?? {}),
                              [contentLocale]: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-xs leading-relaxed text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {isCs
                      ? "Story beaty (jeden na řádek)"
                      : "Story Beats (one per line)"}
                    <textarea
                      rows={4}
                      value={beatsList.join("\n")}
                      onChange={(e) =>
                        updateAct(idx, {
                          beats: {
                            ...(act.beats ?? {}),
                            [contentLocale]: e.target.value
                              .split(/\r?\n/)
                              .filter((l) => l.trim().length > 0),
                          },
                        })
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-xs leading-relaxed text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {isCs
                      ? "Koncepty puzzlů (jeden na řádek)"
                      : "Puzzle Concepts (one per line)"}
                    <textarea
                      rows={3}
                      value={puzzlesList.join("\n")}
                      onChange={(e) =>
                        updateAct(idx, {
                          puzzle_concepts: {
                            ...(act.puzzle_concepts ?? {}),
                            [contentLocale]: e.target.value
                              .split(/\r?\n/)
                              .filter((l) => l.trim().length > 0),
                          },
                        })
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-xs leading-relaxed text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {isCs ? "Přechod / zvrat do dalšího aktu" : "Transition / Twist"}
                    <ClearableInput
                      value={transitionText}
                      onChange={(val) =>
                        updateAct(idx, {
                          transition: {
                            ...(act.transition ?? {}),
                            [contentLocale]: val,
                          },
                        })
                      }
                      className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-xs text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </label>
                </div>
              )}

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
                        ? "Instrukce pro AI k tomuto aktu (např. „uprav vizuální směr do temnější bouřky“ nebo „přidej silnější zvrat“)…"
                        : "AI instruction for this act (e.g. 'shift visual style to stormy twilight' or 'add a sharper twist')…"
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
          );
        })}
      </section>
    </div>
  );
}
