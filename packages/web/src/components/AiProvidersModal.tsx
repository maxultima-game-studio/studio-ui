import { useEffect, useState } from "react";
import { Plus, Trash2, X, KeyRound, RefreshCw, CheckCircle2 } from "lucide-react";
import {
  api,
  type AiModelInfo,
  type AiProviderKind,
  type PublicAiProvider,
} from "../api";
import type { UiLocale } from "../i18n";
import { ClearableInput } from "./ClearableInput";

interface Props {
  open: boolean;
  uiLocale: UiLocale;
  onClose: () => void;
  onModelsUpdated: (models: AiModelInfo[]) => void;
}

const PRESETS: Array<{
  label: string;
  id: string;
  name: string;
  kind: AiProviderKind;
  baseUrl: string;
  defaultModel: string;
}> = [
  {
    label: "OpenCode Go",
    id: "opencode-go",
    name: "OpenCode Go",
    kind: "opencode",
    baseUrl: "https://opencode.ai/zen/go/v1",
    defaultModel: "",
  },
  {
    label: "OpenCode Zen",
    id: "opencode-zen",
    name: "OpenCode Zen",
    kind: "opencode",
    baseUrl: "https://opencode.ai/zen/v1",
    defaultModel: "",
  },
  {
    label: "OpenRouter",
    id: "openrouter",
    name: "OpenRouter",
    kind: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "",
  },
  {
    label: "Custom OpenAI-Compatible",
    id: "custom-openai",
    name: "Custom Provider",
    kind: "openai-compatible",
    baseUrl: "https://",
    defaultModel: "",
  },
];

const inputCls =
  "w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-xs text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

export function AiProvidersModal({
  open,
  uiLocale,
  onClose,
  onModelsUpdated,
}: Props) {
  const [providers, setProviders] = useState<PublicAiProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [id, setId] = useState("opencode-go");
  const [name, setName] = useState("OpenCode Go");
  const [kind, setKind] = useState<AiProviderKind>("opencode");
  const [baseUrl, setBaseUrl] = useState("https://opencode.ai/zen/go/v1");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("");

  const isCs = uiLocale === "cs";

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listProviders();
      setProviders(res.providers);
      onModelsUpdated(res.models);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setInfo(null);
      setError(null);
      void reload();
    }
  }, [open]);

  if (!open) return null;

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setId(p.id);
    setName(p.name);
    setKind(p.kind);
    setBaseUrl(p.baseUrl);
    setDefaultModel(p.defaultModel);
    setApiKey("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.saveProvider({
        id,
        name,
        kind,
        baseUrl,
        apiKey: apiKey || undefined,
        defaultModel: defaultModel || undefined,
      });
      onModelsUpdated(res.models);
      setApiKey("");
      setInfo(
        isCs
          ? `Zdroj "${res.provider.name}" uložen. Nalezeno celkem ${res.models.length} modelů.`
          : `Provider "${res.provider.name}" saved. Found ${res.models.length} total models.`
      );
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (provId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.deleteProvider(provId);
      onModelsUpdated(res.models);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs dark:bg-black/70">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#15181e]">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {isCs ? "AI zdroje & přístupové údaje" : "AI Providers & Credentials"}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {isCs
                ? "Ukládá se lokálně do ~/.config/studio-ui/ai-providers.json (mimo Git). Podporuje Gemini, OpenCode i libovolné OpenAI-compatible API."
                : "Stored locally in ~/.config/studio-ui/ai-providers.json (outside Git). Supports Gemini, OpenCode, and any OpenAI-compatible API."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-200">
              {error}
            </div>
          )}
          {info && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              {info}
            </div>
          )}

          {/* Configured Providers List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {isCs ? "Připojené zdroje" : "Configured Providers"} ({providers.length})
              </span>
              <button
                onClick={() => void reload()}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                {isCs ? "Obnovit modely" : "Refresh models"}
              </button>
            </div>

            {providers.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/60"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {p.name}
                    </span>
                    <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {p.kind}
                    </span>
                    {p.hasApiKey && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        <KeyRound className="h-2.5 w-2.5" />
                        {p.apiKeyPreview}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                    {p.baseUrl}
                  </div>
                </div>
                {!p.builtIn && (
                  <button
                    onClick={() => void handleDelete(p.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isCs ? "Smazat" : "Delete"}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add / Edit Provider Form */}
          <form
            onSubmit={handleSave}
            className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {isCs ? "Přidat nebo upravit AI zdroj" : "Add or Update AI Provider"}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                ID (kebab-case)
                <ClearableInput
                  required
                  value={id}
                  onChange={setId}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                {isCs ? "Název zdroje" : "Provider Name"}
                <ClearableInput
                  required
                  value={name}
                  onChange={setName}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                {isCs ? "Typ protokolu" : "Protocol Kind"}
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as AiProviderKind)}
                  className={inputCls}
                >
                  <option value="opencode">OpenCode (Go / Zen)</option>
                  <option value="openai-compatible">OpenAI-compatible (/v1)</option>
                  <option value="gemini">Google Gemini API</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                Base URL
                <ClearableInput
                  required
                  value={baseUrl}
                  onChange={setBaseUrl}
                  placeholder="https://opencode.ai/zen/go/v1"
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                API Key
                <ClearableInput
                  type="password"
                  value={apiKey}
                  onChange={setApiKey}
                  placeholder="oc_sk_… / sk-…"
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                {isCs ? "Výchozí / záložní ID modelu (volitelné)" : "Fallback Model ID (optional)"}
                <ClearableInput
                  value={defaultModel}
                  onChange={setDefaultModel}
                  placeholder="např. deepseek-v4-flash"
                  className={inputCls}
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Plus className="h-3.5 w-3.5" />
                {isCs ? "Uložit zdroj a načíst modely" : "Save Provider & Load Models"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
