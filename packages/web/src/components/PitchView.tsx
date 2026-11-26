import { useState, useEffect } from "react";
import { Sparkles, Save } from "lucide-react";
import type { GameConfig, GameDesignBundle } from "@studio-ui/shared";
import { dict, type UiLocale } from "../i18n";

interface Props {
  bundle: GameDesignBundle;
  uiLocale: UiLocale;
  contentLocale: string;
  aiBusy: boolean;
  onSavePitch: (pitch: string) => Promise<void>;
  onSaveGame: (game: GameConfig) => Promise<void>;
  onAiExpand: () => Promise<void>;
}

export function PitchView({
  bundle,
  uiLocale,
  contentLocale,
  aiBusy,
  onSavePitch,
  onSaveGame,
  onAiExpand,
}: Props) {
  const t = dict[uiLocale];
  const [pitch, setPitch] = useState(bundle.pitch);
  const [game, setGame] = useState<GameConfig>(bundle.game);

  useEffect(() => {
    setPitch(bundle.pitch);
    setGame(bundle.game);
  }, [bundle.slug, bundle.pitch, bundle.game]);

  const handleSave = async () => {
    await Promise.all([onSavePitch(pitch), onSaveGame(game)]);
  };

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-6 lg:grid-cols-3">
      <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">{t.pitchTitle}</h2>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-700"
            >
              <Save className="h-4 w-4" />
              {t.save}
            </button>
            <button
              onClick={onAiExpand}
              disabled={aiBusy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {aiBusy ? t.aiWorking : t.aiExpandPitch}
            </button>
          </div>
        </div>
        <textarea
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          rows={14}
          className="w-full flex-1 rounded-lg border border-slate-700 bg-slate-950 p-4 font-mono text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
        />
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-base font-semibold text-slate-100">{t.gameConfigTitle}</h2>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t.titleLabel} ({contentLocale.toUpperCase()})
          <input
            value={game.title[contentLocale] ?? ""}
            onChange={(e) =>
              setGame({
                ...game,
                title: { ...game.title, [contentLocale]: e.target.value },
              })
            }
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t.genreLabel}
          <input
            value={game.genre}
            onChange={(e) => setGame({ ...game, genre: e.target.value })}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t.styleLabel}
          <input
            value={game.style}
            onChange={(e) => setGame({ ...game, style: e.target.value })}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t.resolutionLabel}
          <select
            value={game.target_resolution}
            onChange={(e) => setGame({ ...game, target_resolution: e.target.value })}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="480x270">480×270 (×4 Full HD)</option>
            <option value="640x360">640×360 Hi-Bit (×3 Full HD)</option>
            <option value="1920x1080">1920×1080 HD</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t.startSceneLabel}
          <select
            value={game.start_scene_id ?? ""}
            onChange={(e) =>
              setGame({ ...game, start_scene_id: e.target.value || undefined })
            }
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">—</option>
            {bundle.scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} ({s.title[contentLocale] ?? s.title[game.default_locale] ?? s.id})
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1 text-xs text-slate-400">
          <span>{t.localesLabel}</span>
          <div className="flex flex-wrap gap-1.5">
            {game.locales.map((loc) => (
              <span
                key={loc}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-xs uppercase text-slate-200"
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
