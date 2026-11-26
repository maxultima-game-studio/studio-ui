import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type AiProviderKind = "gemini" | "opencode" | "openai-compatible";

export interface StoredAiProvider {
  id: string;
  name: string;
  kind: AiProviderKind;
  baseUrl: string;
  apiKey?: string;
  defaultModel?: string;
  builtIn?: boolean;
}

export interface PublicAiProvider {
  id: string;
  name: string;
  kind: AiProviderKind;
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyPreview?: string;
  defaultModel?: string;
  builtIn?: boolean;
}

export interface AiModelInfo {
  id: string;
  label: string;
  providerId: string;
  providerName: string;
}

export interface AiLogEntry {
  id: string;
  timestamp: string;
  action: string;
  providerId: string;
  providerName: string;
  model: string;
  status: "pending" | "ok" | "error";
  durationMs: number;
  systemPrompt: string;
  userPrompt: string;
  responseText?: string;
  error?: string;
}

const MAX_AI_LOGS = 50;
const aiLogs: AiLogEntry[] = [];

export function getAiLogs(): AiLogEntry[] {
  return [...aiLogs];
}

export function clearAiLogs(): void {
  aiLogs.length = 0;
}

function upsertAiLog(entry: AiLogEntry): void {
  const idx = aiLogs.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    aiLogs[idx] = entry;
  } else {
    aiLogs.push(entry);
    if (aiLogs.length > MAX_AI_LOGS) {
      aiLogs.splice(0, aiLogs.length - MAX_AI_LOGS);
    }
  }
}

const CONFIG_PATH = path.join(
  os.homedir(),
  ".config",
  "studio-ui",
  "ai-providers.json"
);

export const DEFAULT_GEMINI_MODEL =
  process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

async function resolveEnvGeminiKey(): Promise<string | undefined> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const fallbackPaths = ["/home/antigravity/upload/secrets.env", ".env"];
  for (const p of fallbackPaths) {
    try {
      const content = await fs.readFile(p, "utf8");
      const match = content.match(/^GEMINI_API_KEY=(.+)$/m);
      if (match?.[1]) {
        return match[1].trim().replace(/^["']|["']$/g, "");
      }
    } catch {
      // ignore missing file
    }
  }
  return undefined;
}

function maskKey(key?: string): string | undefined {
  if (!key) return undefined;
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

async function readStoredCustomProviders(): Promise<StoredAiProvider[]> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredAiProvider[]) : [];
  } catch {
    return [];
  }
}

async function writeStoredCustomProviders(
  providers: StoredAiProvider[]
): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(providers, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}

export async function getAllProviders(): Promise<StoredAiProvider[]> {
  const envGeminiKey = await resolveEnvGeminiKey();
  const custom = await readStoredCustomProviders();
  const hasCustomGemini = custom.some((p) => p.id === "gemini-default");

  const builtInGemini: StoredAiProvider = {
    id: "gemini-default",
    name: "Google Gemini",
    kind: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: envGeminiKey,
    defaultModel: DEFAULT_GEMINI_MODEL,
    builtIn: true,
  };

  if (hasCustomGemini) {
    return custom.map((p) =>
      p.id === "gemini-default"
        ? { ...builtInGemini, ...p, apiKey: p.apiKey || envGeminiKey, builtIn: true }
        : p
    );
  }
  return [builtInGemini, ...custom];
}

export async function getPublicProviders(): Promise<PublicAiProvider[]> {
  const all = await getAllProviders();
  return all.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    baseUrl: p.baseUrl,
    hasApiKey: Boolean(p.apiKey),
    apiKeyPreview: maskKey(p.apiKey),
    defaultModel: p.defaultModel,
    builtIn: p.builtIn,
  }));
}

export async function upsertProvider(
  input: Omit<StoredAiProvider, "builtIn">
): Promise<PublicAiProvider> {
  const custom = await readStoredCustomProviders();
  const idx = custom.findIndex((p) => p.id === input.id);
  const existing = idx >= 0 ? custom[idx] : undefined;

  const next: StoredAiProvider = {
    id: input.id,
    name: input.name,
    kind: input.kind,
    baseUrl: input.baseUrl.replace(/\/+$/, ""),
    apiKey: input.apiKey?.trim() ? input.apiKey.trim() : existing?.apiKey,
    defaultModel: input.defaultModel?.trim() || undefined,
    builtIn: input.id === "gemini-default",
  };

  if (idx >= 0) custom[idx] = next;
  else custom.push(next);

  await writeStoredCustomProviders(custom);
  const all = await getPublicProviders();
  return all.find((p) => p.id === next.id)!;
}

export async function deleteProvider(id: string): Promise<void> {
  if (id === "gemini-default") {
    throw new Error("Cannot delete built-in Gemini provider");
  }
  const custom = await readStoredCustomProviders();
  await writeStoredCustomProviders(custom.filter((p) => p.id !== id));
}

function isUsableGeminiTextModel(name: string): boolean {
  const id = name.replace(/^models\//, "");
  // Exclude deprecated 2.5 models for new users, image/tts/lyria/embedding/transcribe models
  if (id.startsWith("gemini-2.5-") || id.startsWith("gemini-2.0-")) return false;
  if (
    /image|tts|lyria|transcribe|embedding|aqa|banana|customtools/i.test(id)
  ) {
    return false;
  }
  return id.startsWith("gemini-") || id.startsWith("gemma-");
}

export async function fetchModelsForProvider(
  provider: StoredAiProvider
): Promise<AiModelInfo[]> {
  if (!provider.apiKey && provider.kind === "gemini") {
    return [
      {
        id: DEFAULT_GEMINI_MODEL,
        label: DEFAULT_GEMINI_MODEL,
        providerId: provider.id,
        providerName: provider.name,
      },
    ];
  }

  try {
    if (provider.kind === "gemini") {
      const url = `${provider.baseUrl}/models?key=${encodeURIComponent(provider.apiKey ?? "")}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        models?: Array<{
          name: string;
          displayName?: string;
          supportedGenerationMethods?: string[];
        }>;
      };
      const models = (json.models ?? [])
        .filter(
          (m) =>
            m.supportedGenerationMethods?.includes("generateContent") &&
            isUsableGeminiTextModel(m.name)
        )
        .map((m) => {
          const id = m.name.replace(/^models\//, "");
          return {
            id,
            label: m.displayName ? `${id} (${m.displayName})` : id,
            providerId: provider.id,
            providerName: provider.name,
          };
        });

      // Sort preferred models first
      const preferred = [
        "gemini-3.8-flash",
        "gemini-4-neon",
        "gemini-4-argon",
        "gemini-4-carbon",
        "gemini-3.7-flash",
        "gemini-3.1-pro-preview",
      ];
      models.sort((a, b) => {
        const ai = preferred.indexOf(a.id);
        const bi = preferred.indexOf(b.id);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.id.localeCompare(b.id);
      });

      return models.length > 0
        ? models
        : [
            {
              id: DEFAULT_GEMINI_MODEL,
              label: DEFAULT_GEMINI_MODEL,
              providerId: provider.id,
              providerName: provider.name,
            },
          ];
    }

    // OpenCode / OpenAI-compatible: GET <baseUrl>/models
    const headers: Record<string, string> = {};
    if (provider.apiKey) {
      headers.Authorization = `Bearer ${provider.apiKey}`;
    }
    const res = await fetch(`${provider.baseUrl}/models`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      data?: Array<{ id: string }>;
      models?: Array<{ id?: string; name?: string }>;
    };
    const rawIds = [
      ...(json.data?.map((d) => d.id) ?? []),
      ...(json.models?.map((m) => m.id ?? m.name ?? "") ?? []),
    ].filter(Boolean);

    const unique = Array.from(new Set(rawIds)).sort();
    if (unique.length > 0) {
      return unique.map((id) => ({
        id,
        label: id,
        providerId: provider.id,
        providerName: provider.name,
      }));
    }
  } catch {
    // Fallback to defaultModel if remote /models fails
  }

  if (provider.defaultModel) {
    return [
      {
        id: provider.defaultModel,
        label: provider.defaultModel,
        providerId: provider.id,
        providerName: provider.name,
      },
    ];
  }
  return [];
}

export async function listAllModels(): Promise<AiModelInfo[]> {
  const providers = await getAllProviders();
  const lists = await Promise.all(
    providers.map((p) => fetchModelsForProvider(p))
  );
  return lists.flat();
}

function extractJsonObject<T>(rawText: string): T {
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim()) as T;
    }
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first !== -1 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1)) as T;
    }
    throw new Error("AI response did not contain valid JSON");
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxAttempts = 3
): Promise<Response> {
  let lastRes: Response | undefined;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (
        res.ok ||
        ![429, 500, 502, 503, 504].includes(res.status) ||
        attempt === maxAttempts
      ) {
        return res;
      }
      lastRes = res;
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) throw err;
    }
    await new Promise((r) => setTimeout(r, attempt * 900));
  }
  if (lastRes) return lastRes;
  throw lastErr ?? new Error("AI request failed");
}

function parseFriendlyApiError(providerName: string, model: string, status: number, raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    const msg = parsed.error?.message;
    if (msg) return `${providerName} (${model}, HTTP ${status}): ${msg}`;
  } catch {
    // ignore non-json error
  }
  return `${providerName} (${model}, HTTP ${status}): ${raw.slice(0, 260)}`;
}

export async function callAiJson<T>(params: {
  providerId?: string;
  model?: string;
  sessionId?: string;
  action?: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<{ data: T; model: string; providerId: string }> {
  const startedAt = Date.now();
  const providers = await getAllProviders();
  const provider =
    providers.find((p) => p.id === params.providerId) ?? providers[0];

  if (!provider) {
    throw new Error("No AI provider configured.");
  }

  const chosenModel =
    params.model?.trim() || provider.defaultModel || DEFAULT_GEMINI_MODEL;
  const action = params.action ?? "ai-call";

  const logEntryBase = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    action,
    providerId: provider.id,
    providerName: provider.name,
    model: chosenModel,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
  };

  // Emit immediately so the AI chat window shows the prompt & live progress right away
  upsertAiLog({
    ...logEntryBase,
    status: "pending",
    durationMs: 0,
  });

  try {
    if (provider.kind === "gemini") {
      if (!provider.apiKey) {
        throw new Error(
          `API key is not configured for provider "${provider.name}".`
        );
      }
      const url = `${provider.baseUrl}/models/${encodeURIComponent(chosenModel)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`;
      const res = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: params.systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: params.userPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.5,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(
          parseFriendlyApiError(provider.name, chosenModel, res.status, errText)
        );
      }

      const payload = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini API returned empty content");
      const data = extractJsonObject<T>(text);
      upsertAiLog({
        ...logEntryBase,
        status: "ok",
        durationMs: Date.now() - startedAt,
        responseText: text,
      });
      return {
        data,
        model: chosenModel,
        providerId: provider.id,
      };
    }

    // OpenCode & OpenAI-compatible Chat Completions API
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "maxultima-studio-ui/0.1.0",
    };
    if (provider.apiKey) {
      headers.Authorization = `Bearer ${provider.apiKey}`;
    }
    if (provider.kind === "opencode") {
      headers["x-opencode-session"] =
        params.sessionId ?? "studio-ui-default-session";
    }

    const res = await fetchWithRetry(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: chosenModel,
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        parseFriendlyApiError(provider.name, chosenModel, res.status, errText)
      );
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) throw new Error(`${provider.name} returned empty content`);

    const data = extractJsonObject<T>(text);
    upsertAiLog({
      ...logEntryBase,
      status: "ok",
      durationMs: Date.now() - startedAt,
      responseText: text,
    });
    return {
      data,
      model: chosenModel,
      providerId: provider.id,
    };
  } catch (err) {
    upsertAiLog({
      ...logEntryBase,
      status: "error",
      durationMs: Date.now() - startedAt,
      error: (err as Error).message,
    });
    throw err;
  }
}
