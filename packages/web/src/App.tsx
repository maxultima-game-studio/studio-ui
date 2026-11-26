import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  BookOpen,
  FileText,
  GitBranch,
  Map,
  CheckCircle2,
} from "lucide-react";
import type {
  AiProposal,
  Character,
  Dialogue,
  FlagsFile,
  GameConfig,
  GameDesignBundle,
  Item,
  PipelineSlotStatus,
  ProposalItem,
  Scene,
  ValidationIssue,
  WorldBible,
} from "@studio-ui/shared";
import { api, type DiscoveredGame } from "./api";
import { dict, type UiLocale } from "./i18n";
import { PitchView } from "./components/PitchView";
import { WorldBibleView } from "./components/WorldBibleView";
import { StoryGraphView } from "./components/StoryGraphView";
import { DialogueGraphView } from "./components/DialogueGraphView";
import { ProposalModal } from "./components/ProposalModal";
import {
  ValidationDrawer,
  type AiAuditFinding,
} from "./components/ValidationDrawer";

type Tab = "pitch" | "world" | "scenes" | "dialogues";

export function App() {
  const [games, setGames] = useState<DiscoveredGame[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [bundle, setBundle] = useState<GameDesignBundle | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, PipelineSlotStatus>>({});
  const [tab, setTab] = useState<Tab>("scenes");
  const [uiLocale, setUiLocale] = useState<UiLocale>("cs");
  const [contentLocale, setContentLocale] = useState<string>("cs");
  const [activeDialogueId, setActiveDialogueId] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [proposal, setProposal] = useState<AiProposal | null>(null);
  const [validationOpen, setValidationOpen] = useState(false);
  const [aiFindings, setAiFindings] = useState<AiAuditFinding[]>([]);

  const t = dict[uiLocale];

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const refreshDesign = useCallback(async (slug: string) => {
    if (!slug) return;
    const res = await api.loadDesign(slug);
    setBundle(res.bundle);
    setIssues(res.issues);
    setPipeline(res.pipeline);
  }, []);

  useEffect(() => {
    api.listGames().then((res) => {
      setGames(res.games);
      if (res.games.length > 0) {
        setSelectedSlug(res.games[0].slug);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedSlug) {
      void refreshDesign(selectedSlug);
    }
  }, [selectedSlug, refreshDesign]);

  const handleSavePitch = async (pitch: string) => {
    await api.savePitch(selectedSlug, pitch);
    await refreshDesign(selectedSlug);
    notify(t.saved);
  };

  const handleSaveGame = async (game: GameConfig) => {
    await api.saveGame(selectedSlug, game);
    await refreshDesign(selectedSlug);
    notify(t.saved);
  };

  const handleSaveWorld = async (world: WorldBible) => {
    await api.saveWorld(selectedSlug, world);
    await refreshDesign(selectedSlug);
    notify(t.saved);
  };

  const handleSaveFlags = async (flags: FlagsFile) => {
    await api.saveFlags(selectedSlug, flags);
    await refreshDesign(selectedSlug);
    notify(t.saved);
  };

  const handleSaveCharacter = async (ch: Character) => {
    await api.saveEntity(selectedSlug, "characters", ch);
    await refreshDesign(selectedSlug);
  };

  const handleSaveItem = async (it: Item) => {
    await api.saveEntity(selectedSlug, "items", it);
    await refreshDesign(selectedSlug);
  };

  const handleSaveScene = async (scene: Scene) => {
    await api.saveEntity(selectedSlug, "scenes", scene);
    await refreshDesign(selectedSlug);
  };

  const handleSaveDialogue = async (dlg: Dialogue) => {
    await api.saveEntity(selectedSlug, "dialogues", dlg);
    await refreshDesign(selectedSlug);
  };

  const handleAiExpand = async () => {
    setAiBusy(true);
    try {
      const p = await api.aiExpandPitch(selectedSlug);
      setProposal(p);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const handleAiStructure = async () => {
    setAiBusy(true);
    try {
      const p = await api.aiGenerateStructure(selectedSlug);
      setProposal(p);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const handleApplyProposal = async (items: ProposalItem[]) => {
    const res = await api.aiApplyProposal(selectedSlug, items);
    await refreshDesign(selectedSlug);
    notify(`Applied ${res.applied.length}, skipped locked: ${res.skippedLocked.length}`);
  };

  const handleRunAiAudit = async () => {
    setAiBusy(true);
    try {
      const res = await api.aiReviewLogic(selectedSlug);
      setAiFindings(res.findings);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const handleTriggerPipeline = async (slotId: string) => {
    const res = await api.triggerPipelineSlot(selectedSlug, slotId);
    notify(res.message[uiLocale] ?? res.message.en);
  };

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Bar */}
      <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4">
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm font-bold tracking-tight text-indigo-400">
            maxultima / {t.appTitle}
          </span>

          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-100"
          >
            {games.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.slug}
              </option>
            ))}
          </select>

          <nav className="flex items-center gap-1">
            {(
              [
                ["pitch", t.phase1, FileText],
                ["world", t.phase2, BookOpen],
                ["scenes", t.phase3Scenes, Map],
                ["dialogues", t.phase3Dialogues, GitBranch],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  tab === id
                    ? "bg-indigo-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Content locale switcher */}
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span>{t.contentLang}:</span>
            {(bundle?.game.locales ?? ["cs", "en"]).map((loc) => (
              <button
                key={loc}
                onClick={() => setContentLocale(loc)}
                className={`rounded px-1.5 py-0.5 font-mono uppercase ${
                  contentLocale === loc
                    ? "bg-emerald-600/30 text-emerald-300"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {loc}
              </button>
            ))}
          </div>

          {/* UI locale switcher */}
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span>{t.uiLang}:</span>
            {(["cs", "en"] as const).map((loc) => (
              <button
                key={loc}
                onClick={() => setUiLocale(loc)}
                className={`rounded px-1.5 py-0.5 font-mono uppercase ${
                  uiLocale === loc
                    ? "bg-indigo-600/30 text-indigo-300"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {loc}
              </button>
            ))}
          </div>

          {/* Validation button */}
          <button
            onClick={() => setValidationOpen(true)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
              errorCount > 0
                ? "border-rose-500/40 bg-rose-950/40 text-rose-300"
                : warningCount > 0
                ? "border-amber-500/40 bg-amber-950/40 text-amber-300"
                : "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
            }`}
          >
            {errorCount + warningCount > 0 ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {t.validation} ({errorCount + warningCount})
          </button>
        </div>
      </header>

      {/* Main Content */}
      {bundle && (
        <main>
          {tab === "pitch" && (
            <PitchView
              bundle={bundle}
              uiLocale={uiLocale}
              contentLocale={contentLocale}
              aiBusy={aiBusy}
              onSavePitch={handleSavePitch}
              onSaveGame={handleSaveGame}
              onAiExpand={handleAiExpand}
            />
          )}
          {tab === "world" && (
            <WorldBibleView
              bundle={bundle}
              pipeline={pipeline}
              uiLocale={uiLocale}
              contentLocale={contentLocale}
              aiBusy={aiBusy}
              onSaveWorld={handleSaveWorld}
              onSaveFlags={handleSaveFlags}
              onSaveCharacter={handleSaveCharacter}
              onSaveItem={handleSaveItem}
              onAiGenerateStructure={handleAiStructure}
              onTriggerPipeline={handleTriggerPipeline}
            />
          )}
          {tab === "scenes" && (
            <StoryGraphView
              bundle={bundle}
              pipeline={pipeline}
              uiLocale={uiLocale}
              contentLocale={contentLocale}
              onSaveScene={handleSaveScene}
              onOpenDialogue={(dlgId) => {
                setActiveDialogueId(dlgId);
                setTab("dialogues");
              }}
              onTriggerPipeline={handleTriggerPipeline}
            />
          )}
          {tab === "dialogues" && (
            <DialogueGraphView
              bundle={bundle}
              initialDialogueId={activeDialogueId}
              uiLocale={uiLocale}
              contentLocale={contentLocale}
              onSaveDialogue={handleSaveDialogue}
            />
          )}
        </main>
      )}

      {proposal && (
        <ProposalModal
          proposal={proposal}
          uiLocale={uiLocale}
          onApply={handleApplyProposal}
          onClose={() => setProposal(null)}
        />
      )}

      <ValidationDrawer
        open={validationOpen}
        issues={issues}
        aiFindings={aiFindings}
        aiBusy={aiBusy}
        uiLocale={uiLocale}
        onRunAiAudit={handleRunAiAudit}
        onClose={() => setValidationOpen(false)}
      />

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-indigo-500/40 bg-slate-900 px-4 py-2 text-xs text-slate-100 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
