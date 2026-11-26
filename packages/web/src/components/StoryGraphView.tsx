import { useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import { Lock, Unlock, Plus, MessageSquare, Play, Save, Flag } from "lucide-react";
import type {
  GameDesignBundle,
  PipelineSlotStatus,
  Scene,
} from "@studio-ui/shared";
import { dict, type UiLocale } from "../i18n";

interface SceneNodeData extends Record<string, unknown> {
  scene: Scene;
  contentLocale: string;
  isStart: boolean;
  puzzleCount: number;
}

function SceneCardNode({ data, selected }: NodeProps<Node<SceneNodeData>>) {
  const { scene, contentLocale, isStart, puzzleCount } = data;
  return (
    <div
      className={`w-64 rounded-2xl border bg-white p-3.5 shadow-sm transition dark:bg-[#15181e] ${
        selected
          ? "border-blue-500 ring-2 ring-blue-500/25"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-blue-500" />
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
          {scene.id}
        </span>
        <div className="flex items-center gap-1">
          {isStart && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              START
            </span>
          )}
          {scene.locked && <Lock className="h-3 w-3 text-amber-500" />}
        </div>
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {scene.title[contentLocale] ?? scene.id}
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        {scene.description[contentLocale] ?? ""}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1 border-t border-zinc-100 pt-2 text-[10px] text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
          Chars: {scene.characters.length}
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
          Hotspots: {scene.hotspots.length}
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
          Puzzles: {puzzleCount}
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
          Slots: {scene.asset_slots.length}
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-emerald-500" />
    </div>
  );
}

const nodeTypes = { sceneCard: SceneCardNode };

interface Props {
  bundle: GameDesignBundle;
  pipeline: Record<string, PipelineSlotStatus>;
  uiLocale: UiLocale;
  contentLocale: string;
  darkMode: boolean;
  onSaveScene: (scene: Scene) => Promise<void>;
  onSetStartScene: (sceneId: string) => Promise<void>;
  onOpenDialogue: (dialogueId: string) => void;
  onTriggerPipeline: (slotId: string) => Promise<void>;
}

export function StoryGraphView({
  bundle,
  pipeline,
  uiLocale,
  contentLocale,
  darkMode,
  onSaveScene,
  onSetStartScene,
  onOpenDialogue,
  onTriggerPipeline,
}: Props) {
  const t = dict[uiLocale];
  const [selectedId, setSelectedId] = useState<string | null>(
    bundle.scenes[0]?.id ?? null
  );

  const selectedScene = bundle.scenes.find((s) => s.id === selectedId) ?? null;

  const nodes: Node<SceneNodeData>[] = useMemo(
    () =>
      bundle.scenes.map((scene) => ({
        id: scene.id,
        type: "sceneCard",
        position: scene.graph_position,
        selected: scene.id === selectedId,
        data: {
          scene,
          contentLocale,
          isStart: bundle.game.start_scene_id === scene.id,
          puzzleCount: bundle.puzzles.filter((p) => p.scene_id === scene.id).length,
        },
      })),
    [bundle.scenes, bundle.game.start_scene_id, bundle.puzzles, contentLocale, selectedId]
  );

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    for (const scene of bundle.scenes) {
      for (const exit of scene.exits) {
        out.push({
          id: `${scene.id}__${exit.id}`,
          source: scene.id,
          target: exit.target_scene_id,
          label: exit.label[contentLocale] ?? exit.id,
          animated: Boolean(exit.condition),
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: exit.condition ? "#f59e0b" : "#3b82f6",
          },
          style: { stroke: exit.condition ? "#f59e0b" : "#3b82f6", strokeWidth: 2 },
          labelStyle: { fill: darkMode ? "#e4e4e7" : "#27272a", fontSize: 11 },
          labelBgStyle: {
            fill: darkMode ? "#15181e" : "#ffffff",
            fillOpacity: 0.95,
          },
        });
      }
    }
    return out;
  }, [bundle.scenes, contentLocale, darkMode]);

  const handleNodeDragStop = useCallback(
    (_evt: unknown, node: Node) => {
      const scene = bundle.scenes.find((s) => s.id === node.id);
      if (!scene) return;
      void onSaveScene({
        ...scene,
        graph_position: {
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
        },
      });
    },
    [bundle.scenes, onSaveScene]
  );

  const handleConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target || conn.source === conn.target) return;
      const sourceScene = bundle.scenes.find((s) => s.id === conn.source);
      if (!sourceScene) return;
      const exitId = `to-${conn.target}`;
      if (sourceScene.exits.some((e) => e.target_scene_id === conn.target)) return;
      void onSaveScene({
        ...sourceScene,
        exits: [
          ...sourceScene.exits,
          {
            id: exitId,
            target_scene_id: conn.target,
            label: { cs: `Do ${conn.target}`, en: `To ${conn.target}` },
          },
        ],
      });
    },
    [bundle.scenes, onSaveScene]
  );

  const handleAddScene = async () => {
    const idx = bundle.scenes.length + 1;
    const id = `scene-${idx}`;
    const next: Scene = {
      id,
      locked: false,
      title: { cs: `Nová lokace ${idx}`, en: `New Scene ${idx}` },
      description: { cs: "", en: "" },
      visual_brief: "",
      graph_position: { x: 160 + idx * 80, y: 160 + idx * 40 },
      characters: [],
      exits: [],
      hotspots: [],
      asset_slots: [
        {
          slot_id: `${id}-bg`,
          kind: "background",
          brief: "Scene background",
        },
      ],
    };
    await onSaveScene(next);
    setSelectedId(id);
  };

  const scenePuzzles = selectedScene
    ? bundle.puzzles.filter((p) => p.scene_id === selectedScene.id)
    : [];

  return (
    <div className="flex h-[calc(100vh-56px)] w-full">
      <div className="relative flex-1 bg-[#f8f9fb] dark:bg-[#0d0f12]">
        <div className="absolute left-4 top-4 z-10 flex gap-2">
          <button
            onClick={handleAddScene}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.addScene}
          </button>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_e, n) => setSelectedId(n.id)}
          onNodeDragStop={handleNodeDragStop}
          onConnect={handleConnect}
          fitView
        >
          <Background color={darkMode ? "#27272a" : "#e4e4e7"} gap={20} />
          <Controls />
          <MiniMap
            nodeColor={darkMode ? "#3b82f6" : "#2563eb"}
            maskColor={darkMode ? "rgba(13,15,18,0.75)" : "rgba(248,249,251,0.75)"}
            className="!rounded-xl !border !border-zinc-200 !bg-white dark:!border-zinc-800 dark:!bg-[#15181e]"
          />
        </ReactFlow>
      </div>

      {/* Right Scene Inspector */}
      <aside className="w-96 overflow-y-auto border-l border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#15181e]">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t.sceneInspector}
        </h3>
        {!selectedScene ? (
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            {t.selectNodeHint}
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                {selectedScene.id}
              </span>
              <div className="flex items-center gap-1.5">
                {bundle.game.start_scene_id === selectedScene.id ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                    <Flag className="h-3 w-3" />
                    {t.isStartScene}
                  </span>
                ) : (
                  <button
                    onClick={() => onSetStartScene(selectedScene.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] text-zinc-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    <Flag className="h-3 w-3" />
                    {t.setStartScene}
                  </button>
                )}
                <button
                  onClick={() =>
                    onSaveScene({ ...selectedScene, locked: !selectedScene.locked })
                  }
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${
                    selectedScene.locked
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {selectedScene.locked ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Unlock className="h-3 w-3" />
                  )}
                  {selectedScene.locked ? t.locked : t.unlocked}
                </button>
              </div>
            </div>

            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Title ({contentLocale.toUpperCase()})
              <input
                value={selectedScene.title[contentLocale] ?? ""}
                onChange={(e) =>
                  onSaveScene({
                    ...selectedScene,
                    title: { ...selectedScene.title, [contentLocale]: e.target.value },
                  })
                }
                className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Description ({contentLocale.toUpperCase()})
              <textarea
                rows={3}
                value={selectedScene.description[contentLocale] ?? ""}
                onChange={(e) =>
                  onSaveScene({
                    ...selectedScene,
                    description: {
                      ...selectedScene.description,
                      [contentLocale]: e.target.value,
                    },
                  })
                }
                className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-2.5 text-xs text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Visual Brief
              <textarea
                rows={2}
                value={selectedScene.visual_brief}
                onChange={(e) =>
                  onSaveScene({ ...selectedScene, visual_brief: e.target.value })
                }
                className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-2.5 text-xs text-zinc-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>

            {/* Exits */}
            <div className="space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <div className="text-xs font-semibold uppercase text-zinc-400">
                {t.exits} ({selectedScene.exits.length})
              </div>
              {selectedScene.exits.map((ex) => (
                <div
                  key={ex.id}
                  className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950/70"
                >
                  <div className="flex justify-between font-mono text-[11px] text-blue-600 dark:text-blue-400">
                    <span>{ex.id}</span>
                    <span>→ {ex.target_scene_id}</span>
                  </div>
                  <div className="mt-0.5 text-zinc-800 dark:text-zinc-200">
                    {ex.label[contentLocale] ?? ex.id}
                  </div>
                  {ex.condition && (
                    <div className="mt-1 font-mono text-[10px] text-amber-600 dark:text-amber-300">
                      requires: {ex.condition.type}={ex.condition.ref}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Hotspots */}
            <div className="space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <div className="text-xs font-semibold uppercase text-zinc-400">
                {t.hotspots} ({selectedScene.hotspots.length})
              </div>
              {selectedScene.hotspots.map((hs) => (
                <div
                  key={hs.id}
                  className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950/70"
                >
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {hs.label[contentLocale] ?? hs.id}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {hs.description[contentLocale] ?? ""}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {hs.item_id && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        item:{hs.item_id}
                      </span>
                    )}
                    {hs.puzzle_id && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                        puzzle:{hs.puzzle_id}
                      </span>
                    )}
                    {hs.dialogue_id && (
                      <button
                        onClick={() => onOpenDialogue(hs.dialogue_id!)}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-600/30 dark:text-blue-200 dark:hover:bg-blue-600/50"
                      >
                        <MessageSquare className="h-3 w-3" />
                        {t.openDialogue}: {hs.dialogue_id}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Puzzles in scene */}
            {scenePuzzles.length > 0 && (
              <div className="space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div className="text-xs font-semibold uppercase text-zinc-400">
                  {t.puzzles} ({scenePuzzles.length})
                </div>
                {scenePuzzles.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-xs dark:border-amber-500/30 dark:bg-amber-950/20"
                  >
                    <div className="font-semibold text-amber-800 dark:text-amber-200">
                      {p.title[contentLocale] ?? p.id}
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-300">
                      {p.summary[contentLocale] ?? ""}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Asset Slots (Pipeline Bridge) */}
            <div className="space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <div className="text-xs font-semibold uppercase text-zinc-400">
                {t.assetSlots} ({selectedScene.asset_slots.length})
              </div>
              {selectedScene.asset_slots.map((slot) => {
                const st = pipeline[slot.slot_id];
                return (
                  <div
                    key={slot.slot_id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200">
                        {slot.slot_id}
                      </span>
                      <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-[10px] uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {st?.status ?? "unlinked"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {slot.brief}
                    </p>
                    {st?.preview_url && (
                      <img
                        src={st.preview_url}
                        alt={slot.slot_id}
                        className="mt-2 w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
                        style={{ imageRendering: "pixelated" }}
                      />
                    )}
                    <button
                      onClick={() => onTriggerPipeline(slot.slot_id)}
                      className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-blue-400 dark:hover:bg-zinc-800"
                    >
                      <Play className="h-3 w-3" />
                      {t.triggerPipeline}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              <Save className="h-3 w-3" /> Auto-saved to design/scenes/{selectedScene.id}.yaml
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
