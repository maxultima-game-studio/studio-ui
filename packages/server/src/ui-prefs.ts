import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PREFS_PATH = path.join(
  os.homedir(),
  ".config",
  "studio-ui",
  "ui-prefs.json"
);

export type UiPrefs = Record<string, unknown>;

export async function loadUiPrefs(): Promise<UiPrefs> {
  try {
    const raw = await fs.readFile(PREFS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as UiPrefs) : {};
  } catch {
    return {};
  }
}

export async function saveUiPrefs(partial: UiPrefs): Promise<UiPrefs> {
  const current = await loadUiPrefs();
  const merged = { ...current, ...partial };
  await fs.mkdir(path.dirname(PREFS_PATH), { recursive: true });
  await fs.writeFile(PREFS_PATH, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}
