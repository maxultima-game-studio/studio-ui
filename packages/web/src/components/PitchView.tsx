import { useState, useEffect } from "react";
import {
  Sparkles,
  Save,
  Wand2,
  Check,
  X,
  Send,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import type { GameConfig, GameDesignBundle } from "@studio-ui/shared";
import { dict, type UiLocale } from "../i18n";
import { ClearableInput } from "./ClearableInput";

interface Props {
  bundle: GameDesignBundle;
  uiLocale: UiLocale;
  contentLocale: string;
  aiBusy: boolean;
  onSavePitch: (pitch: string) => Promise<void>;
  onSaveStoryPlan: (storyPlan: string) => Promise<void>;
  onSaveGame: (game: GameConfig) => Promise<void>;
  onAiRefinePitch: (params: {
    currentPitch: string;
    instruction: string;
    mode: "generate" | "refine";
  }) => Promise<{ model: string; pitch: string; rationale: string } | null>;
  onAiPlanStory: (params: {
    currentPitch: string;
    currentPlan: string;
    actCount: number;
    message: string;
    history: Array<{ role: "user" | "assistant"; text: string }>;
  }) => Promise<{
    model: string;
    reply: string;
    suggestedActCount: number;
    storyPlan: string;
  } | null>;
  onAiExpand: (params: { actCount: number; storyPlan: string }) => Promise<void>;
}

const inputCls =
  "rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-sm text-zinc-900 transition focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:bg-zinc-950";

export function PitchView({
  bundle,
  uiLocale,
  contentLocale,
  aiBusy,
  onSavePitch,
  onSaveStoryPlan,
  onSaveGame,
  onAiRefinePitch,
  onAiPlanStory,
  onAiExpand,
}: Props) {
  const t = dict[uiLocale];
  const isCs = uiLocale === "cs";

  const [pitch, setPitch] = useState(bundle.pitch);
  const [game, setGame] = useState<GameConfig>(bundle.game);
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState<{
    model: string;
    pitch: string;
    rationale: string;
  } | null>(null);

  // Story planning sub-card state
  const [actCount, setActCount] = useState<number>(
    Math.max(1, Math.min(6, bundle.world.acts.length || 3))
  );
  const [storyPlan, setStoryPlan] = useState(bundle.story_plan ?? "");
  const [planInput, setPlanInput] = useState("");
  const [planChat, setPlanChat] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([]);

  useEffect(() => {
    setPitch(bundle.pitch);
    setGame(bundle.game);
    setStoryPlan(bundle.story_plan ?? "");
    setDraft(null);
  }, [bundle.slug, bundle.pitch, bundle.story_plan, bundle.game]);

  const handleSaveAll = async () => {
    await Promise.all([
      onSavePitch(pitch),
      onSaveStoryPlan(storyPlan),
      onSaveGame(game),
    ]);
  };

  const handleRunPitchAi = async (mode: "generate" | "refine") => {
    const res = await onAiRefinePitch({
      currentPitch: pitch,
      instruction,
      mode,
    });
    if (res) {
      setDraft(res);
      setInstruction("");
    }
  };

  const handleApplyDraft = async () => {
    if (!draft) return;
    setPitch(draft.pitch);
    setDraft(null);
    await onSavePitch(draft.pitch);
  };

  const handleSendPlanChat = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const userMsg =
      planInput.trim() ||
      (isCs
        ? `Navrhni plán rozpracování této nosné myšlenky do ${actCount} aktů.`
        : `Propose an expansion plan for this pitch across ${actCount} acts.`);

    const res = await onAiPlanStory({
      currentPitch: pitch,
      currentPlan: storyPlan,
      actCount,
      message: userMsg,
      history: planChat,
    });

    if (res) {
      setPlanChat((prev) => [
        ...prev,
        { role: "user", text: userMsg },
        { role: "assistant", text: res.reply },
      ]);
      setActCount(res.suggestedActCount);
      setStoryPlan(res.storyPlan);
      setPlanInput("");
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-6 p-6 lg:grid-cols-3">
      {/* Left 2/3 Column: Card 1 (Pitch) + Card 2 (Story Plan & Expand to Step 2) */}
      <div className="flex flex-col gap-6 lg:col-span-2">
        {/* Card 1: Core Pitch */}
        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-xs dark:border-zinc-800/90 dark:bg-[#15181e]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {t.pitchTitle}
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {t.pitchSubtitle}
              </p>
            </div>
            <button
              onClick={handleSaveAll}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <Save className="h-3.5 w-3.5" />
              {t.save}
            </button>
          </div>

          {/* AI Pitch Generator / Refiner Bar */}
          <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <ClearableInput
              value={instruction}
              onChange={setInstruction}
              placeholder={t.pitchAiPlaceholder}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleRunPitchAi("generate")}
                disabled={aiBusy}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-blue-500 dark:hover:text-blue-400"
              >
                <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                {t.pitchAiGenerate}
              </button>
              <button
                onClick={() => handleRunPitchAi("refine")}
                disabled={aiBusy}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-blue-500 dark:hover:text-blue-400"
              >
                <Wand2 className="h-3.5 w-3.5 text-blue-500" />
                {t.pitchAiRefine}
              </button>
            </div>
          </div>

          {/* Inline AI Pitch Proposal Preview */}
          {draft && (
            <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                    {t.pitchDraftTitle}{" "}
                    <span className="font-mono font-normal opacity-75">
                      ({draft.model})
                    </span>
                  </div>
                  {draft.rationale && (
                    <p className="mt-0.5 text-xs text-blue-700/80 dark:text-blue-300/80">
                      {draft.rationale}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setDraft(null)}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t.pitchDraftDiscard}
                  </button>
                  <button
                    onClick={handleApplyDraft}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t.pitchDraftApply}
                  </button>
                </div>
              </div>
              <div className="whitespace-pre-wrap rounded-lg border border-blue-200/70 bg-white p-3 font-mono text-xs text-zinc-800 dark:border-blue-900/50 dark:bg-zinc-950 dark:text-zinc-200">
                {draft.pitch}
              </div>
            </div>
          )}

          <textarea
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            rows={9}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 font-mono text-sm leading-relaxed text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:bg-zinc-950"
          />
        </section>

        {/* Card 2: Story Expansion Plan & AI Discussion before Step 2 */}
        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-xs dark:border-zinc-800/90 dark:bg-[#15181e]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                {isCs
                  ? "Plán rozpracování do aktů (design/story-plan.md)"
                  : "Story & Acts Expansion Plan (design/story-plan.md)"}
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {isCs
                  ? "Vylaď s AI rozsah hry, počet aktů a klíčové body osnovy, než AI vygeneruje celý příběh v Kroku 2."
                  : "Discuss scope, act count, and narrative beats with AI before generating the full story in Step 2."}
              </p>
            </div>

            {/* Act count selector */}
            <div className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-zinc-500 dark:text-zinc-400">
                {isCs ? "Počet aktů:" : "Acts:"}
              </span>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setActCount(n)}
                  className={`h-6 w-6 rounded-full font-mono text-xs font-medium transition ${
                    actCount === n
                      ? "bg-blue-600 text-white"
                      : "text-zinc-600 hover:bg-zinc-200/80 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Mini AI Planning Conversation */}
          {planChat.length > 0 && (
            <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-zinc-200/80 bg-[#f8f9fb] p-3 text-xs dark:border-zinc-800 dark:bg-[#0d0f12]">
              {planChat.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-sm bg-blue-600 text-white"
                        : "rounded-bl-sm border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-[#15181e] dark:text-zinc-200"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chat Input to discuss act scope with AI */}
          <form
            onSubmit={handleSendPlanChat}
            className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-2.5 sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <div className="flex-1">
              <ClearableInput
                value={planInput}
                onChange={setPlanInput}
                placeholder={
                  isCs
                    ? "Poraď se s AI (např. „Chci krátkou hru na 3 akty s nečekaným koncem“ nebo pošli prázdné pro návrh)…"
                    : "Discuss with AI (e.g. 'Make it a tight 3-act mystery with a twist ending', or send empty for a proposal)…"
                }
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <button
              type="submit"
              disabled={aiBusy}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-800 transition hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              <Send className="h-3.5 w-3.5 text-blue-500" />
              {aiBusy
                ? t.aiWorking
                : isCs
                ? "Doladit plán s AI"
                : "Discuss plan with AI"}
            </button>
          </form>

          {/* Editable Story Plan Brief */}
          <textarea
            value={storyPlan}
            onChange={(e) => setStoryPlan(e.target.value)}
            rows={7}
            placeholder={
              isCs
                ? "Zde vznikne výsledný plán rozpracování do aktů (můžeš ho upravit ručně nebo přes AI konverzaci výše)…"
                : "The resulting act expansion plan will appear here (edit manually or via the AI conversation above)…"
            }
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 text-sm leading-relaxed text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100"
          />

          {/* Footer Action: Expand into Step 2 */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <button
              onClick={() => void onSaveStoryPlan(storyPlan)}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <Save className="h-3.5 w-3.5" />
              {isCs ? "Uložit plán" : "Save plan"}
            </button>

            <button
              onClick={() => void onAiExpand({ actCount, storyPlan })}
              disabled={aiBusy}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiBusy
                ? t.aiWorking
                : `${t.aiExpandPitch} (${actCount})`}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      </div>

      {/* Right 1/3 Column: Project Settings Card */}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-xs dark:border-zinc-800/90 dark:bg-[#15181e]">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t.gameConfigTitle}
        </h2>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {t.titleLabel} ({contentLocale.toUpperCase()})
          <ClearableInput
            value={game.title[contentLocale] ?? ""}
            onChange={(val) =>
              setGame({
                ...game,
                title: { ...game.title, [contentLocale]: val },
              })
            }
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {t.genreLabel}
          <ClearableInput
            value={game.genre}
            onChange={(val) => setGame({ ...game, genre: val })}
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {t.styleLabel}
          <ClearableInput
            value={game.style}
            onChange={(val) => setGame({ ...game, style: val })}
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {t.resolutionLabel}
          <select
            value={game.target_resolution}
            onChange={(e) => setGame({ ...game, target_resolution: e.target.value })}
            className={inputCls}
          >
            <option value="480x270">480×270 (×4 Full HD)</option>
            <option value="640x360">640×360 Hi-Bit (×3 Full HD)</option>
            <option value="1920x1080">1920×1080 HD</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {t.engineLabel}
          <select
            value={game.target_engine}
            onChange={(e) => setGame({ ...game, target_engine: e.target.value })}
            className={inputCls}
          >
            <option value="engine-pnc-2d">engine-pnc-2d</option>
            <option value="engine-pnc-3d">engine-pnc-3d (planned)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {t.pipelineLabel}
          <select
            value={game.target_pipeline}
            onChange={(e) => setGame({ ...game, target_pipeline: e.target.value })}
            className={inputCls}
          >
            <option value="pipeline-pnc-pixel">pipeline-pnc-pixel</option>
            <option value="pipeline-pnc-hd">pipeline-pnc-hd (planned)</option>
          </select>
        </label>

        <div className="flex flex-col gap-1.5 pt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <span>{t.localesLabel}</span>
          <div className="flex flex-wrap gap-1.5">
            {game.locales.map((loc) => (
              <span
                key={loc}
                className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 font-mono text-xs uppercase text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {loc}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
