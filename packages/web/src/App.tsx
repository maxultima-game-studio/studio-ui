import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  AlertTriangle,
  BookOpen,
  FileText,
  GitBranch,
  Layers,
  Map as MapIcon,
  CheckCircle2,
  Sun,
  Moon,
  Cpu,
  Settings2,
} from "lucide-react";
import type {
  Character,
  Dialogue,
  FlagsFile,
  GameConfig,
  GameDesignBundle,
  Item,
  PipelineSlotStatus,
  Puzzle,
  Scene,
  ValidationIssue,
  WorldBible,
} from "@studio-ui/shared";
import {
  api,
  type AiLogEntry,
  type AiModelInfo,
  type DiscoveredGame,
  type FloatingWindowPref,
  type StudioUiPrefs,
} from "./api";
import { dict, type UiLocale } from "./i18n";
import { PitchView } from "./components/PitchView";
import { StoryActsView } from "./components/StoryActsView";
import { ActDetailsView } from "./components/ActDetailsView";
import { StoryGraphView } from "./components/StoryGraphView";
import { DialogueGraphView } from "./components/DialogueGraphView";
import { ConfirmDialog } from "./components/ConfirmDialog";
import {
  ValidationDrawer,
  type AiAuditFinding,
} from "./components/ValidationDrawer";
import { AiProvidersModal } from "./components/AiProvidersModal";
import { BottomDock, type NotificationItem } from "./components/BottomDock";

type Tab = "pitch" | "story" | "entities" | "scenes" | "dialogues";

const PREFS_LS_KEY = "studio-ui:prefs:v1";

function loadLocalPrefs(): StudioUiPrefs {
  try {
    const raw = localStorage.getItem(PREFS_LS_KEY);
    return raw ? (JSON.parse(raw) as StudioUiPrefs) : {};
  } catch {
    return {};
  }
}

function normalizeTab(raw: unknown): Tab {
  if (
    raw === "pitch" ||
    raw === "story" ||
    raw === "entities" ||
    raw === "scenes" ||
    raw === "dialogues"
  ) {
    return raw;
  }
  if (raw === "world") return "story";
  return "pitch";
}

function defaultChatWin(): FloatingWindowPref {
  return {
    open: false,
    pinned: false,
    x: Math.max(16, window.innerWidth - 540),
    y: Math.max(72, window.innerHeight - 470),
    w: 520,
    h: 420,
  };
}

function defaultNotifWin(): FloatingWindowPref {
  return {
    open: false,
    pinned: false,
    x: Math.max(16, window.innerWidth - 440),
    y: Math.max(72, window.innerHeight - 410),
    w: 420,
    h: 360,
  };
}

export function App() {
  const initialLocal = useMemo(() => loadLocalPrefs(), []);

  const [games, setGames] = useState<DiscoveredGame[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>(
    initialLocal.selectedSlug ?? ""
  );
  const [bundle, setBundle] = useState<GameDesignBundle | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, PipelineSlotStatus>>({});
  const [tab, setTab] = useState<Tab>(normalizeTab(initialLocal.tab));
  const [uiLocale, setUiLocale] = useState<UiLocale>(
    initialLocal.uiLocale ?? "cs"
  );
  const [contentLocale, setContentLocale] = useState<string>(
    initialLocal.contentLocale ?? "cs"
  );
  const [activeDialogueId, setActiveDialogueId] = useState<string | null>(null);

  const [darkMode, setDarkMode] = useState<boolean>(
    initialLocal.darkMode ?? false
  );

  const [availableModels, setAvailableModels] = useState<AiModelInfo[]>([]);
  const [selectedModelKey, setSelectedModelKey] = useState<string>(
    initialLocal.selectedModelKey ?? ""
  );
  const [providersOpen, setProvidersOpen] = useState(false);

  const [chatWin, setChatWin] = useState<FloatingWindowPref>(
    initialLocal.chatWindow ?? defaultChatWin
  );
  const [notifWin, setNotifWin] = useState<FloatingWindowPref>(
    initialLocal.notifWindow ?? defaultNotifWin
  );

  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("studio-ui:notifications") ?? "[]"
      );
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [aiLogs, setAiLogs] = useState<AiLogEntry[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    | { kind: "expand-story"; storyPlan: string }
    | { kind: "generate-structure" }
    | null
  >(null);
  const [validationOpen, setValidationOpen] = useState(false);
  const [aiFindings, setAiFindings] = useState<AiAuditFinding[]>([]);

  const t = dict[uiLocale];

  const activeAiTarget = useMemo(() => {
    if (selectedModelKey.includes("::")) {
      const [providerId, ...rest] = selectedModelKey.split("::");
      return { providerId, model: rest.join("::") };
    }
    const first = availableModels[0];
    return first
      ? { providerId: first.providerId, model: first.id }
      : { providerId: "gemini-default", model: "gemini-3.8-flash" };
  }, [selectedModelKey, availableModels]);

  const modelsByProvider = useMemo(() => {
    const map = new Map<string, { name: string; items: AiModelInfo[] }>();
    for (const m of availableModels) {
      const group = map.get(m.providerId) ?? { name: m.providerName, items: [] };
      group.items.push(m);
      map.set(m.providerId, group);
    }
    return Array.from(map.entries());
  }, [availableModels]);

  const syncModels = useCallback((models: AiModelInfo[], preferredKey?: string) => {
    setAvailableModels(models);
    if (models.length === 0) return;
    setSelectedModelKey((prev) => {
      const candidate = preferredKey || prev;
      if (candidate && models.some((m) => `${m.providerId}::${m.id}` === candidate)) {
        return candidate;
      }
      return `${models[0].providerId}::${models[0].id}`;
    });
  }, []);

  const refreshAiLogs = useCallback(async () => {
    try {
      const res = await api.getAiLogs();
      setAiLogs(res.logs);
    } catch {
      // ignore transient error
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem(
      "studio-ui:notifications",
      JSON.stringify(notifications.slice(0, 40))
    );
  }, [notifications]);

  useEffect(() => {
    if (!prefsHydrated) return;
    const prefs: StudioUiPrefs = {
      selectedSlug,
      tab,
      uiLocale,
      contentLocale,
      darkMode,
      selectedModelKey,
      chatWindow: chatWin,
      notifWindow: notifWin,
    };
    localStorage.setItem(PREFS_LS_KEY, JSON.stringify(prefs));
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void api.saveUiPrefs(prefs).catch(() => {});
    }, 350);
  }, [
    prefsHydrated,
    selectedSlug,
    tab,
    uiLocale,
    contentLocale,
    darkMode,
    selectedModelKey,
    chatWin,
    notifWin,
  ]);

  const notify = (
    msg: string,
    severity: NotificationItem["severity"] = "info"
  ) => {
    setToast(msg);
    setNotifications((prev) =>
      [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          severity,
          message: msg,
        },
        ...prev,
      ].slice(0, 40)
    );
    setTimeout(() => setToast(null), 4500);
  };

  const refreshDesign = useCallback(async (slug: string) => {
    if (!slug) return;
    const res = await api.loadDesign(slug);
    setBundle(res.bundle);
    setIssues(res.issues);
    setPipeline(res.pipeline);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const [prefsRes, healthRes, gamesRes] = await Promise.all([
        api.getUiPrefs().catch(() => ({ prefs: {} as StudioUiPrefs })),
        api.health(),
        api.listGames(),
      ]);
      if (cancelled) return;

      const sp = prefsRes.prefs ?? {};
      if (sp.tab) setTab(normalizeTab(sp.tab));
      if (sp.uiLocale) setUiLocale(sp.uiLocale);
      if (sp.contentLocale) setContentLocale(sp.contentLocale);
      if (typeof sp.darkMode === "boolean") setDarkMode(sp.darkMode);
      if (sp.chatWindow) setChatWin(sp.chatWindow);
      if (sp.notifWindow) setNotifWin(sp.notifWindow);

      syncModels(
        healthRes.ai.availableModels ?? [],
        sp.selectedModelKey ?? initialLocal.selectedModelKey
      );

      setGames(gamesRes.games);
      const preferredSlug = sp.selectedSlug ?? initialLocal.selectedSlug;
      if (
        preferredSlug &&
        gamesRes.games.some((g) => g.slug === preferredSlug)
      ) {
        setSelectedSlug(preferredSlug);
      } else if (gamesRes.games.length > 0) {
        setSelectedSlug(gamesRes.games[0].slug);
      }

      setPrefsHydrated(true);
      void refreshAiLogs();
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [syncModels, refreshAiLogs, initialLocal]);

  useEffect(() => {
    if (selectedSlug) {
      void refreshDesign(selectedSlug);
    }
  }, [selectedSlug, refreshDesign]);

  const handleSavePitch = async (pitch: string) => {
    await api.savePitch(selectedSlug, pitch);
    await refreshDesign(selectedSlug);
    notify(t.saved, "success");
  };

  const handleSaveStoryPlan = async (storyPlan: string) => {
    await api.saveStoryPlan(selectedSlug, storyPlan);
    await refreshDesign(selectedSlug);
    notify(t.saved, "success");
  };

  const handleSaveGame = async (game: GameConfig) => {
    await api.saveGame(selectedSlug, game);
    await refreshDesign(selectedSlug);
    notify(t.saved, "success");
  };

  const handleSetStartScene = async (sceneId: string) => {
    if (!bundle) return;
    await handleSaveGame({ ...bundle.game, start_scene_id: sceneId });
  };

  const handleSaveWorld = async (world: WorldBible) => {
    await api.saveWorld(selectedSlug, world);
    await refreshDesign(selectedSlug);
    notify(t.saved, "success");
  };

  const handleSaveFlags = async (flags: FlagsFile) => {
    await api.saveFlags(selectedSlug, flags);
    await refreshDesign(selectedSlug);
    notify(t.saved, "success");
  };

  const handleSaveCharacter = async (ch: Character) => {
    await api.saveEntity(selectedSlug, "characters", ch);
    await refreshDesign(selectedSlug);
  };

  const handleSaveItem = async (it: Item) => {
    await api.saveEntity(selectedSlug, "items", it);
    await refreshDesign(selectedSlug);
  };

  const handleSavePuzzle = async (pz: Puzzle) => {
    await api.saveEntity(selectedSlug, "puzzles", pz);
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

  const handleAiRefinePitch = async (params: {
    currentPitch: string;
    instruction: string;
    mode: "generate" | "refine";
  }) => {
    setAiBusy(true);
    try {
      return await api.aiRefinePitch(
        selectedSlug,
        {
          ...params,
          locale: contentLocale,
          ...activeAiTarget,
        },
        () => void refreshAiLogs()
      );
    } catch (e) {
      notify((e as Error).message, "error");
      return null;
    } finally {
      setAiBusy(false);
      void refreshAiLogs();
    }
  };

  const handleAiPlanStory = async (params: {
    currentPitch: string;
    currentPlan: string;
    message: string;
    history: Array<{ role: "user" | "assistant"; text: string }>;
  }) => {
    setAiBusy(true);
    try {
      const res = await api.aiPlanStory(
        selectedSlug,
        {
          ...params,
          locale: contentLocale,
          ...activeAiTarget,
        },
        () => void refreshAiLogs()
      );
      await refreshDesign(selectedSlug);
      return res;
    } catch (e) {
      notify((e as Error).message, "error");
      return null;
    } finally {
      setAiBusy(false);
      void refreshAiLogs();
    }
  };

  const executeAiExpandStory = async (params: { storyPlan: string }) => {
    setConfirmAction(null);
    setAiBusy(true);
    try {
      const res = await api.aiExpandStory(
        selectedSlug,
        { ...activeAiTarget, ...params },
        () => {
          void refreshAiLogs();
        }
      );
      await refreshDesign(selectedSlug);
      setTab("story");
      notify(
        uiLocale === "cs"
          ? `Příběh & akty vygenerovány podle plánu (${res.model}).`
          : `Story & acts generated from plan (${res.model}).`,
        "success"
      );
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setAiBusy(false);
      void refreshAiLogs();
    }
  };

  const handleRefineAct = async (actId: string, instruction: string) => {
    setAiBusy(true);
    try {
      const res = await api.aiRefineAct(
        selectedSlug,
        { actId, instruction, ...activeAiTarget },
        () => void refreshAiLogs()
      );
      await refreshDesign(selectedSlug);
      notify(res.rationale || t.saved, "success");
      return true;
    } catch (e) {
      notify((e as Error).message, "error");
      return false;
    } finally {
      setAiBusy(false);
      void refreshAiLogs();
    }
  };

  const handleGenerateActEntities = async (actId: string) => {
    setAiBusy(true);
    try {
      const res = await api.aiGenerateActEntities(
        selectedSlug,
        { actId, ...activeAiTarget },
        () => void refreshAiLogs()
      );
      await refreshDesign(selectedSlug);
      notify(
        uiLocale === "cs"
          ? `Entity pro ${actId} vygenerovány (${res.applied.length} prvků).`
          : `Entities generated for ${actId} (${res.applied.length} items).`,
        "success"
      );
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setAiBusy(false);
      void refreshAiLogs();
    }
  };

  const handleRefineEntity = async (
    entityKind: "characters" | "items" | "puzzles",
    entityId: string,
    instruction: string
  ) => {
    setAiBusy(true);
    try {
      const res = await api.aiRefineEntity(
        selectedSlug,
        { entityKind, entityId, instruction, ...activeAiTarget },
        () => void refreshAiLogs()
      );
      await refreshDesign(selectedSlug);
      notify(res.rationale || t.saved, "success");
      return true;
    } catch (e) {
      notify((e as Error).message, "error");
      return false;
    } finally {
      setAiBusy(false);
      void refreshAiLogs();
    }
  };

  const executeAiStructure = async () => {
    setConfirmAction(null);
    setAiBusy(true);
    try {
      const res = await api.aiGenerateStructure(
        selectedSlug,
        activeAiTarget,
        () => {
          void refreshAiLogs();
        }
      );
      await refreshDesign(selectedSlug);
      setTab("scenes");
      notify(
        uiLocale === "cs"
          ? `Lokace & dialogy vygenerovány (${res.applied.length} prvků).`
          : `Scenes & dialogues generated (${res.applied.length} items).`,
        "success"
      );
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setAiBusy(false);
      void refreshAiLogs();
    }
  };

  const handleRunAiAudit = async () => {
    setAiBusy(true);
    try {
      const res = await api.aiReviewLogic(selectedSlug, activeAiTarget, () => {
        void refreshAiLogs();
      });
      setAiFindings(res.findings);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setAiBusy(false);
      void refreshAiLogs();
    }
  };

  const handleTriggerPipeline = async (slotId: string) => {
    const res = await api.triggerPipelineSlot(selectedSlug, slotId);
    notify(res.message[uiLocale] ?? res.message.en, "info");
  };

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return (
    <div className="min-h-screen bg-[#f8f9fb] pb-10 pt-14 text-zinc-900 transition-colors dark:bg-[#0d0f12] dark:text-zinc-100">
      {/* Antigravity Fixed Top Bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-zinc-200/80 bg-white/95 px-4 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#15181e]/95">
        <div className="flex items-center gap-2.5 overflow-x-auto">
          <div className="flex shrink-0 items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
            <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t.appTitle}
            </span>
          </div>

          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {games.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.slug}
              </option>
            ))}
          </select>

          <nav className="flex shrink-0 items-center gap-0.5 rounded-full border border-zinc-200/90 bg-zinc-100/80 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/80">
            {(
              [
                ["pitch", t.phase1, FileText],
                ["story", t.phase2Story, BookOpen],
                ["entities", t.phase3Entities, Layers],
                ["scenes", t.phase4Scenes, MapIcon],
                ["dialogues", t.phase4Dialogues, GitBranch],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition ${
                  tab === id
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* AI Model Selector + Provider Settings Button */}
          <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-0.5 pl-2.5 pr-1 text-xs dark:border-zinc-700 dark:bg-zinc-900">
            <Cpu className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
            <select
              value={selectedModelKey}
              onChange={(e) => setSelectedModelKey(e.target.value)}
              className="max-w-40 truncate bg-transparent text-xs font-medium text-zinc-800 focus:outline-none dark:text-zinc-100"
              title={t.aiModelLabel}
            >
              {modelsByProvider.map(([provId, group]) => (
                <optgroup
                  key={provId}
                  label={group.name}
                  className="dark:bg-zinc-900"
                >
                  {group.items.map((m) => (
                    <option
                      key={`${m.providerId}::${m.id}`}
                      value={`${m.providerId}::${m.id}`}
                    >
                      {m.id}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              onClick={() => setProvidersOpen(true)}
              title={
                uiLocale === "cs"
                  ? "Nastavit AI zdroje (Gemini, OpenCode, OpenAI-compatible)"
                  : "Configure AI Providers (Gemini, OpenCode, OpenAI-compatible)"
              }
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-200/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Content locale switcher */}
          <div className="flex items-center gap-0.5 rounded-full border border-zinc-200 bg-zinc-50 p-0.5 text-[11px] dark:border-zinc-800 dark:bg-zinc-900">
            <span className="px-1.5 text-zinc-400">{t.contentLang}</span>
            {(bundle?.game.locales ?? ["cs", "en"]).map((loc) => (
              <button
                key={loc}
                onClick={() => setContentLocale(loc)}
                className={`rounded-full px-2 py-0.5 font-mono uppercase transition ${
                  contentLocale === loc
                    ? "bg-emerald-600 text-white"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {loc}
              </button>
            ))}
          </div>

          {/* UI locale switcher */}
          <div className="flex items-center gap-0.5 rounded-full border border-zinc-200 bg-zinc-50 p-0.5 text-[11px] dark:border-zinc-800 dark:bg-zinc-900">
            {(["cs", "en"] as const).map((loc) => (
              <button
                key={loc}
                onClick={() => setUiLocale(loc)}
                className={`rounded-full px-2 py-0.5 font-mono uppercase transition ${
                  uiLocale === loc
                    ? "bg-zinc-900 text-white dark:bg-zinc-700"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {loc}
              </button>
            ))}
          </div>

          {/* Light / Dark Theme Toggle */}
          <button
            onClick={() => setDarkMode((d) => !d)}
            title={darkMode ? t.themeLight : t.themeDark}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Validation button */}
          <button
            onClick={() => setValidationOpen(true)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
              errorCount > 0
                ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-300"
                : warningCount > 0
                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
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
              onSaveStoryPlan={handleSaveStoryPlan}
              onSaveGame={handleSaveGame}
              onAiRefinePitch={handleAiRefinePitch}
              onAiPlanStory={handleAiPlanStory}
              onAiExpand={async (params) =>
                setConfirmAction({ kind: "expand-story", ...params })
              }
            />
          )}
          {tab === "story" && (
            <StoryActsView
              bundle={bundle}
              uiLocale={uiLocale}
              contentLocale={contentLocale}
              aiBusy={aiBusy}
              onSaveWorld={handleSaveWorld}
              onRefineAct={handleRefineAct}
              onGoToEntities={() => setTab("entities")}
            />
          )}
          {tab === "entities" && (
            <ActDetailsView
              bundle={bundle}
              pipeline={pipeline}
              uiLocale={uiLocale}
              contentLocale={contentLocale}
              aiBusy={aiBusy}
              onSaveCharacter={handleSaveCharacter}
              onSaveItem={handleSaveItem}
              onSavePuzzle={handleSavePuzzle}
              onSaveFlags={handleSaveFlags}
              onGenerateActEntities={handleGenerateActEntities}
              onRefineEntity={handleRefineEntity}
              onAiGenerateStructure={async () =>
                setConfirmAction({ kind: "generate-structure" })
              }
              onTriggerPipeline={handleTriggerPipeline}
            />
          )}
          {tab === "scenes" && (
            <StoryGraphView
              bundle={bundle}
              pipeline={pipeline}
              uiLocale={uiLocale}
              contentLocale={contentLocale}
              darkMode={darkMode}
              onSaveScene={handleSaveScene}
              onSetStartScene={handleSetStartScene}
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
              darkMode={darkMode}
              onSaveDialogue={handleSaveDialogue}
            />
          )}
        </main>
      )}

      <ConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction?.kind === "expand-story"
            ? uiLocale === "cs"
              ? "Rozpracovat pitch do příběhu a aktů?"
              : "Expand pitch into story & acts?"
            : uiLocale === "cs"
            ? "Vygenerovat novou strukturu lokací a dialogů?"
            : "Generate new scenes, puzzles, and dialogues?"
        }
        description={
          confirmAction?.kind === "expand-story"
            ? uiLocale === "cs"
              ? "Spuštěním AI rozpracování se podle tvého plánu vygeneruje ucelený příběh rozdělený do aktů (Krok 2) a vymažou se předchozí nezamčené entity z Kroků 3 a 4A/4B. Zamčené entity (locked) zůstanou zachovány. Po dokončení se rovnou přepne na Krok 2."
              : "Running AI expansion will generate a cohesive multi-act story (Step 2) following your plan and clear previous unlocked entities in Steps 3 and 4A/4B. Locked entities are preserved. You will be taken directly to Step 2."
            : uiLocale === "cs"
            ? "Spuštěním generování se vymažou předchozí nezamčené Lokace (4A), Puzzly a Dialogy (4B) a vygenerují se nové podle definovaných aktů a entit. Zamčené entity zůstanou zachovány."
            : "Generating structure will replace unlocked Scenes (4A), Puzzles, and Dialogues (4B) based on your acts and entities. Locked entities are preserved."
        }
        confirmLabel={
          uiLocale === "cs" ? "Ano, spustit AI generování" : "Yes, run AI generation"
        }
        cancelLabel={uiLocale === "cs" ? "Zrušit" : "Cancel"}
        onConfirm={() => {
          if (confirmAction?.kind === "expand-story") {
            void executeAiExpandStory({
              storyPlan: confirmAction.storyPlan,
            });
          } else if (confirmAction?.kind === "generate-structure") {
            void executeAiStructure();
          }
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <AiProvidersModal
        open={providersOpen}
        uiLocale={uiLocale}
        onClose={() => setProvidersOpen(false)}
        onModelsUpdated={(models) => syncModels(models)}
      />

      <ValidationDrawer
        open={validationOpen}
        issues={issues}
        aiFindings={aiFindings}
        aiBusy={aiBusy}
        uiLocale={uiLocale}
        onRunAiAudit={handleRunAiAudit}
        onClose={() => setValidationOpen(false)}
      />

      <BottomDock
        uiLocale={uiLocale}
        gameSlug={selectedSlug}
        activeModelLabel={`${activeAiTarget.providerId} / ${activeAiTarget.model}`}
        notifications={notifications}
        aiLogs={aiLogs}
        notifWin={notifWin}
        chatWin={chatWin}
        onChangeNotifWin={setNotifWin}
        onChangeChatWin={setChatWin}
        onClearNotifications={() => setNotifications([])}
        onRefreshAiLogs={refreshAiLogs}
        onClearAiLogs={async () => {
          await api.clearAiLogs();
          setAiLogs([]);
        }}
      />

      {toast && (
        <div className="fixed bottom-12 left-1/2 z-50 max-w-2xl -translate-x-1/2 rounded-2xl border border-zinc-200 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
          {toast}
        </div>
      )}
    </div>
  );
}
