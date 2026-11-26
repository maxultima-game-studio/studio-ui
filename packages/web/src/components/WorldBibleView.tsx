import { useState, useEffect } from "react";
import { Lock, Unlock, Sparkles, Save, Play } from "lucide-react";
import type {
  Character,
  FlagsFile,
  GameDesignBundle,
  Item,
  PipelineSlotStatus,
  WorldBible,
} from "@studio-ui/shared";
import { dict, type UiLocale } from "../i18n";

interface Props {
  bundle: GameDesignBundle;
  pipeline: Record<string, PipelineSlotStatus>;
  uiLocale: UiLocale;
  contentLocale: string;
  aiBusy: boolean;
  onSaveWorld: (world: WorldBible) => Promise<void>;
  onSaveFlags: (flags: FlagsFile) => Promise<void>;
  onSaveCharacter: (ch: Character) => Promise<void>;
  onSaveItem: (it: Item) => Promise<void>;
  onAiGenerateStructure: () => Promise<void>;
  onTriggerPipeline: (slotId: string) => Promise<void>;
}

export function WorldBibleView({
  bundle,
  pipeline,
  uiLocale,
  contentLocale,
  aiBusy,
  onSaveWorld,
  onSaveFlags,
  onSaveCharacter,
  onSaveItem,
  onAiGenerateStructure,
  onTriggerPipeline,
}: Props) {
  const t = dict[uiLocale];
  const [world, setWorld] = useState<WorldBible>(bundle.world);
  const [flags, setFlags] = useState<FlagsFile>(bundle.flags);

  useEffect(() => {
    setWorld(bundle.world);
    setFlags(bundle.flags);
  }, [bundle]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-100">{t.worldTitle}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => onSaveWorld(world)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-700"
          >
            <Save className="h-4 w-4" />
            {t.save}
          </button>
          <button
            onClick={onAiGenerateStructure}
            disabled={aiBusy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {aiBusy ? t.aiWorking : t.aiGenerateStructure}
          </button>
        </div>
      </div>

      {/* World card */}
      <section className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Setting ({contentLocale.toUpperCase()})
            </span>
            <button
              onClick={() => setWorld({ ...world, locked: !world.locked })}
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${
                world.locked
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {world.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              {world.locked ? t.locked : t.unlocked}
            </button>
          </div>
          <textarea
            rows={3}
            value={world.setting[contentLocale] ?? ""}
            onChange={(e) =>
              setWorld({
                ...world,
                setting: { ...world.setting, [contentLocale]: e.target.value },
              })
            }
            className="rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-sm text-slate-100"
          />
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Visual Style Brief
            <textarea
              rows={2}
              value={world.visual_style}
              onChange={(e) => setWorld({ ...world, visual_style: e.target.value })}
              className="rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-sm text-slate-100"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Acts ({world.acts.length})
          </span>
          {world.acts.map((act, idx) => (
            <div
              key={act.id}
              className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
            >
              <div className="text-xs font-mono text-indigo-400">{act.id}</div>
              <input
                value={act.title[contentLocale] ?? ""}
                onChange={(e) => {
                  const next = [...world.acts];
                  next[idx] = {
                    ...act,
                    title: { ...act.title, [contentLocale]: e.target.value },
                  };
                  setWorld({ ...world, acts: next });
                }}
                className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-sm font-medium text-slate-100"
              />
              <textarea
                rows={2}
                value={act.summary[contentLocale] ?? ""}
                onChange={(e) => {
                  const next = [...world.acts];
                  next[idx] = {
                    ...act,
                    summary: { ...act.summary, [contentLocale]: e.target.value },
                  };
                  setWorld({ ...world, acts: next });
                }}
                className="mt-1.5 w-full rounded border border-slate-800 bg-slate-900 p-2 text-xs text-slate-300"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Characters */}
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-slate-200">
          {t.charactersTitle} ({bundle.characters.length})
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {bundle.characters.map((ch) => (
            <div
              key={ch.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-indigo-400">{ch.id}</span>
                  <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[11px] uppercase text-slate-300">
                    {ch.role}
                  </span>
                </div>
                <button
                  onClick={() => onSaveCharacter({ ...ch, locked: !ch.locked })}
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${
                    ch.locked
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {ch.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {ch.locked ? t.locked : t.unlocked}
                </button>
              </div>
              <div className="text-sm font-semibold text-slate-100">
                {ch.name[contentLocale] ?? ch.id}
              </div>
              <p className="text-xs text-slate-300">{ch.bio[contentLocale] ?? ""}</p>
              <p className="text-xs text-slate-400">
                <strong className="text-slate-300">Visual brief:</strong> {ch.visual_brief}
              </p>
              <div className="flex flex-wrap gap-1.5 border-t border-slate-800 pt-2">
                {ch.asset_slots.map((slot) => {
                  const st = pipeline[slot.slot_id]?.status ?? "unlinked";
                  return (
                    <button
                      key={slot.slot_id}
                      onClick={() => onTriggerPipeline(slot.slot_id)}
                      className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-300 hover:border-indigo-500"
                      title={slot.brief}
                    >
                      <Play className="h-3 w-3 text-indigo-400" />
                      {slot.slot_id}
                      <span className="rounded bg-slate-800 px-1 text-[10px] text-slate-400">
                        {st}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Items & Flags */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-slate-200">
            {t.itemsTitle} ({bundle.items.length})
          </h3>
          {bundle.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-emerald-400">{item.id}</span>
                <button
                  onClick={() => onSaveItem({ ...item, locked: !item.locked })}
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${
                    item.locked
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {item.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {item.locked ? t.locked : t.unlocked}
                </button>
              </div>
              <div className="text-sm font-semibold text-slate-100">
                {item.name[contentLocale] ?? item.id}
              </div>
              <p className="text-xs text-slate-300">
                {item.description[contentLocale] ?? ""}
              </p>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-200">
              {t.flagsTitle} ({flags.flags.length})
            </h3>
            <button
              onClick={() => onSaveFlags(flags)}
              className="rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700"
            >
              {t.save}
            </button>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            {flags.flags.map((flag) => (
              <div
                key={flag.id}
                className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-amber-300">{flag.id}</span>
                  <span className="text-[11px] text-slate-500">
                    init: {String(flag.initial_value)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  {flag.description[contentLocale] ?? ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
