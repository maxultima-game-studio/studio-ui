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
import { Lock, Unlock, Plus, MessageSquare, Play, Save } from "lucide-react";
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
      className={`w-64 rounded-xl border bg-slate-900 p-3 shadow-lg transition ${
        selected ? "border-indigo-400 ring-2 ring-indigo-500/40" : "border-slate-700"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-indigo-400" />
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[11px] text-indigo-300">{scene.id}</span>
        <div className="flex items-center gap-1">
          {isStart && (
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              START
            </span>
          )}
          {scene.locked && <Lock className="h-3 w-3 text-amber-300" />}
        </div>
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-100">
        {scene.title[contentLocale] ?? scene.id}
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
        {scene.description[contentLocale] ?? ""}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1 border-t border-slate-800 pt-2 text-[10px] text-slate-300">
        <span className="rounded bg-slate-800 px-1.5 py-0.5">
          Chars: {scene.characters.length}
        </span>
        <span className="rounded bg-slate-800 px-1.5 py-0.5">
          Hotspots: {scene.hotspots.length}
        </span>
        <span className="rounded bg-slate-800 px-1.5 py-0.5">
          Puzzles: {puzzleCount}
        </span>
        <span className="rounded bg-slate-800 px-1.5 py-0.5">
          Slots: {scene.asset_slots.length}
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-emerald-400" />
    </div>
  );
}

const nodeTypes = { sceneCard: SceneCardNode };

interface Props {
  bundle: GameDesignBundle;
  pipeline: Record<string, PipelineSlotStatus>;
  uiLocale: UiLocale;
  contentLocale: string;
  onSaveScene: (scene: Scene) => Promise<void>;
  onOpenDialogue: (dialogueId: string) => void;
  onTriggerPipeline: (slotId: string) => Promise<void>;
}

export function StoryGraphView({
  bundle,
  pipeline,
  uiLocale,
  contentLocale,
  onSaveScene,
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
          markerEnd: { type: MarkerType.ArrowClosed, color: "#818cf8" },
          style: { stroke: exit.condition ? "#f59e0b" : "#818cf8", strokeWidth: 2 },
          labelStyle: { fill: "#e2e8f0", fontSize: 11 },
          labelBgStyle: { fill: "#0f172a", fillOpacity: 0.9 },
        });
      }
    }
    return out;
  }, [bundle.scenes, contentLocale]);

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
      <div className="relative flex-1 bg-slate-950">
        <div className="absolute left-4 top-4 z-10 flex gap-2">
          <button
            onClick={handleAddScene}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-indigo-500"
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
          <Background color="#1e293b" gap={20} />
          <Controls />
          <MiniMap
            nodeColor="#4f46e5"
            maskColor="rgba(2,6,23,0.75)"
            className="!bg-slate-900"
          />
        </ReactFlow>
      </div>

      {/* Right Scene Inspector */}
      <aside className="w-96 overflow-y-auto border-l border-slate-800 bg-slate-900/90 p-4">
        <h3 className="text-sm font-semibold text-slate-100">{t.sceneInspector}</h3>
        {!selectedScene ? (
          <p className="mt-4 text-xs text-slate-400">{t.selectNodeHint}</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-indigo-300">
                {selectedScene.id}
              </span>
              <button
                onClick={() =>
                  onSaveScene({ ...selectedScene, locked: !selectedScene.locked })
                }
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${
                  selectedScene.locked
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-slate-800 text-slate-400"
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

            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Title ({contentLocale.toUpperCase()})
              <input
                value={selectedScene.title[contentLocale] ?? ""}
                onChange={(e) =>
                  onSaveScene({
                    ...selectedScene,
                    title: { ...selectedScene.title, [contentLocale]: e.target.value },
                  })
                }
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-slate-400">
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
                className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-slate-100"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Visual Brief
              <textarea
                rows={2}
                value={selectedScene.visual_brief}
                onChange={(e) =>
                  onSaveScene({ ...selectedScene, visual_brief: e.target.value })
                }
                className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-slate-100"
              />
            </label>

            {/* Exits */}
            <div className="space-y-1.5 border-t border-slate-800 pt-3">
              <div className="text-xs font-semibold uppercase text-slate-400">
                {t.exits} ({selectedScene.exits.length})
              </div>
              {selectedScene.exits.map((ex) => (
                <div
                  key={ex.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-xs"
                >
                  <div className="flex justify-between font-mono text-[11px] text-indigo-300">
                    <span>{ex.id}</span>
                    <span>→ {ex.target_scene_id}</span>
                  </div>
                  <div className="mt-0.5 text-slate-200">
                    {ex.label[contentLocale] ?? ex.id}
                  </div>
                  {ex.condition && (
                    <div className="mt-1 font-mono text-[10px] text-amber-300">
                      requires: {ex.condition.type}={ex.condition.ref}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Hotspots */}
            <div className="space-y-1.5 border-t border-slate-800 pt-3">
              <div className="text-xs font-semibold uppercase text-slate-400">
                {t.hotspots} ({selectedScene.hotspots.length})
              </div>
              {selectedScene.hotspots.map((hs) => (
                <div
                  key={hs.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-xs"
                >
                  <div className="font-semibold text-slate-100">
                    {hs.label[contentLocale] ?? hs.id}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {hs.description[contentLocale] ?? ""}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {hs.item_id && (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                        item:{hs.item_id}
                      </span>
                    )}
                    {hs.puzzle_id && (
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                        puzzle:{hs.puzzle_id}
                      </span>
                    )}
                    {hs.dialogue_id && (
                      <button
                        onClick={() => onOpenDialogue(hs.dialogue_id!)}
                        className="inline-flex items-center gap-1 rounded bg-indigo-600/30 px-2 py-0.5 text-[10px] font-medium text-indigo-200 hover:bg-indigo-600/50"
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
              <div className="space-y-1.5 border-t border-slate-800 pt-3">
                <div className="text-xs font-semibold uppercase text-slate-400">
                  {t.puzzles} ({scenePuzzles.length})
                </div>
                {scenePuzzles.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2 text-xs"
                  >
                    <div className="font-semibold text-amber-200">
                      {p.title[contentLocale] ?? p.id}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-300">
                      {p.summary[contentLocale] ?? ""}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Asset Slots (Pipeline Bridge) */}
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <div className="text-xs font-semibold uppercase text-slate-400">
                {t.assetSlots} ({selectedScene.asset_slots.length})
              </div>
              {selectedScene.asset_slots.map((slot) => {
                const st = pipeline[slot.slot_id];
                return (
                  <div
                    key={slot.slot_id}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-slate-200">
                        {slot.slot_id}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                        {st?.status ?? "unlinked"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{slot.brief}</p>
                    {st?.preview_url && (
                      <img
                        src={st.preview_url}
                        alt={slot.slot_id}
                        className="mt-2 w-full rounded border border-slate-800"
                        style={{ imageRendering: "pixelated" }}
                      />
                    )}
                    <button
                      onClick={() => onTriggerPipeline(slot.slot_id)}
                      className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-indigo-300 hover:bg-slate-700"
                    >
                      <Play className="h-3 w-3" />
                      {t.triggerPipeline}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Save className="h-3 w-3" /> Auto-saved to design/scenes/{selectedScene.id}.yaml
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
