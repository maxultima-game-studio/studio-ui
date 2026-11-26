import { useMemo, useState, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import { Plus, Trash2, Lock, Unlock } from "lucide-react";
import type {
  Dialogue,
  DialogueNode,
  GameDesignBundle,
} from "@studio-ui/shared";
import { dict, type UiLocale } from "../i18n";

interface DlgNodeData extends Record<string, unknown> {
  node: DialogueNode;
  contentLocale: string;
  isStart: boolean;
}

function DialogueCardNode({ data, selected }: NodeProps<Node<DlgNodeData>>) {
  const { node, contentLocale, isStart } = data;
  const colorMap = {
    npc_line: "border-sky-500/60 bg-slate-900",
    player_choice: "border-violet-500/60 bg-slate-900",
    effect: "border-amber-500/60 bg-slate-900",
    end: "border-rose-500/60 bg-slate-900",
  };

  return (
    <div
      className={`w-64 rounded-xl border p-3 shadow-lg ${colorMap[node.type]} ${
        selected ? "ring-2 ring-indigo-400" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-300" />
      <div className="flex items-center justify-between text-[10px] uppercase">
        <span className="font-mono text-slate-300">{node.type}</span>
        {isStart && (
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-semibold text-emerald-300">
            START
          </span>
        )}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-indigo-300">{node.id}</div>

      {node.type === "npc_line" && (
        <p className="mt-1.5 line-clamp-3 text-xs text-slate-100">
          {node.speaker_id ? `${node.speaker_id}: ` : ""}
          {node.text?.[contentLocale] ?? ""}
        </p>
      )}

      {node.type === "player_choice" && (
        <ul className="mt-1.5 space-y-1 text-[11px] text-violet-200">
          {(node.choices ?? []).map((c) => (
            <li key={c.id} className="truncate rounded bg-violet-950/50 px-1.5 py-0.5">
              • {c.text[contentLocale] ?? c.id}
            </li>
          ))}
        </ul>
      )}

      {node.effects && node.effects.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {node.effects.map((e, i) => (
            <span
              key={i}
              className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-200"
            >
              {e.type}:{e.ref}
            </span>
          ))}
        </div>
      )}

      {node.type !== "end" && (
        <Handle type="source" position={Position.Right} className="!bg-indigo-400" />
      )}
    </div>
  );
}

const nodeTypes = { dlgCard: DialogueCardNode };

interface Props {
  bundle: GameDesignBundle;
  initialDialogueId?: string | null;
  uiLocale: UiLocale;
  contentLocale: string;
  onSaveDialogue: (dialogue: Dialogue) => Promise<void>;
}

export function DialogueGraphView({
  bundle,
  initialDialogueId,
  uiLocale,
  contentLocale,
  onSaveDialogue,
}: Props) {
  const t = dict[uiLocale];
  const [activeDlgId, setActiveDlgId] = useState<string>(
    initialDialogueId ?? bundle.dialogues[0]?.id ?? ""
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (initialDialogueId) {
      setActiveDlgId(initialDialogueId);
      setSelectedNodeId(null);
    }
  }, [initialDialogueId]);

  const activeDialogue =
    bundle.dialogues.find((d) => d.id === activeDlgId) ?? bundle.dialogues[0] ?? null;

  const selectedNode =
    activeDialogue && selectedNodeId ? activeDialogue.nodes[selectedNodeId] ?? null : null;

  const nodes: Node<DlgNodeData>[] = useMemo(() => {
    if (!activeDialogue) return [];
    return Object.values(activeDialogue.nodes).map((n) => ({
      id: n.id,
      type: "dlgCard",
      position: n.position,
      selected: n.id === selectedNodeId,
      data: {
        node: n,
        contentLocale,
        isStart: activeDialogue.start_node_id === n.id,
      },
    }));
  }, [activeDialogue, contentLocale, selectedNodeId]);

  const edges: Edge[] = useMemo(() => {
    if (!activeDialogue) return [];
    const out: Edge[] = [];
    for (const n of Object.values(activeDialogue.nodes)) {
      if (n.next_node_id) {
        out.push({
          id: `${n.id}->${n.next_node_id}`,
          source: n.id,
          target: n.next_node_id,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#38bdf8" },
          style: { stroke: "#38bdf8", strokeWidth: 2 },
        });
      }
      if (n.choices) {
        for (const c of n.choices) {
          if (!c.next_node_id) continue;
          out.push({
            id: `${n.id}:${c.id}->${c.next_node_id}`,
            source: n.id,
            target: c.next_node_id,
            label: (c.text[contentLocale] ?? c.id).slice(0, 28),
            markerEnd: { type: MarkerType.ArrowClosed, color: "#a78bfa" },
            style: { stroke: "#a78bfa", strokeWidth: 2 },
            labelStyle: { fill: "#e2e8f0", fontSize: 10 },
            labelBgStyle: { fill: "#0f172a", fillOpacity: 0.9 },
          });
        }
      }
    }
    return out;
  }, [activeDialogue, contentLocale]);

  const updateNode = useCallback(
    (updated: DialogueNode) => {
      if (!activeDialogue) return;
      void onSaveDialogue({
        ...activeDialogue,
        nodes: {
          ...activeDialogue.nodes,
          [updated.id]: updated,
        },
      });
    },
    [activeDialogue, onSaveDialogue]
  );

  const handleNodeDragStop = useCallback(
    (_e: unknown, node: Node) => {
      if (!activeDialogue) return;
      const existing = activeDialogue.nodes[node.id];
      if (!existing) return;
      updateNode({
        ...existing,
        position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
      });
    },
    [activeDialogue, updateNode]
  );

  const handleConnect = useCallback(
    (conn: Connection) => {
      if (!activeDialogue || !conn.source || !conn.target) return;
      const src = activeDialogue.nodes[conn.source];
      if (!src) return;
      if (src.type === "player_choice") {
        const nextChoiceId = `choice-${(src.choices?.length ?? 0) + 1}`;
        updateNode({
          ...src,
          choices: [
            ...(src.choices ?? []),
            {
              id: nextChoiceId,
              text: { cs: "Nová volba", en: "New choice" },
              next_node_id: conn.target,
            },
          ],
        });
      } else {
        updateNode({ ...src, next_node_id: conn.target });
      }
    },
    [activeDialogue, updateNode]
  );

  const handleAddNode = (type: DialogueNode["type"]) => {
    if (!activeDialogue) return;
    const count = Object.keys(activeDialogue.nodes).length + 1;
    const id = `${type.replace("_", "-")}-${count}`;
    const newNode: DialogueNode = {
      id,
      type,
      position: { x: 140 + count * 60, y: 120 + (count % 3) * 110 },
      speaker_id: type === "npc_line" ? activeDialogue.character_id : undefined,
      text: type === "npc_line" ? { cs: "...", en: "..." } : undefined,
      choices:
        type === "player_choice"
          ? [{ id: "opt-1", text: { cs: "Volba 1", en: "Option 1" } }]
          : undefined,
    };
    updateNode(newNode);
    setSelectedNodeId(id);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!activeDialogue) return;
    const nextNodes = { ...activeDialogue.nodes };
    delete nextNodes[nodeId];
    void onSaveDialogue({ ...activeDialogue, nodes: nextNodes });
    setSelectedNodeId(null);
  };

  const handleCreateDialogue = async () => {
    const idx = bundle.dialogues.length + 1;
    const id = `dialogue-${idx}`;
    const dlg: Dialogue = {
      id,
      locked: false,
      scene_id: bundle.scenes[0]?.id,
      character_id: bundle.characters[0]?.id,
      title: { cs: `Nový dialog ${idx}`, en: `New Dialogue ${idx}` },
      start_node_id: "start",
      nodes: {
        start: {
          id: "start",
          type: "npc_line",
          position: { x: 100, y: 140 },
          speaker_id: bundle.characters[0]?.id,
          text: { cs: "Dobrý den.", en: "Hello there." },
          next_node_id: "end",
        },
        end: {
          id: "end",
          type: "end",
          position: { x: 460, y: 140 },
        },
      },
    };
    await onSaveDialogue(dlg);
    setActiveDlgId(id);
    setSelectedNodeId("start");
  };

  return (
    <div className="flex h-[calc(100vh-56px)] w-full">
      <div className="relative flex-1 bg-slate-950">
        <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/95 p-2 shadow">
          <select
            value={activeDialogue?.id ?? ""}
            onChange={(e) => {
              setActiveDlgId(e.target.value);
              setSelectedNodeId(null);
            }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-100"
          >
            {bundle.dialogues.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id} — {d.title[contentLocale] ?? d.id}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreateDialogue}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.addDialogue}
          </button>
          {activeDialogue && (
            <>
              <button
                onClick={() => handleAddNode("npc_line")}
                className="rounded bg-sky-600/30 px-2 py-1 text-xs text-sky-200 hover:bg-sky-600/50"
              >
                + NPC
              </button>
              <button
                onClick={() => handleAddNode("player_choice")}
                className="rounded bg-violet-600/30 px-2 py-1 text-xs text-violet-200 hover:bg-violet-600/50"
              >
                + Choice
              </button>
              <button
                onClick={() => handleAddNode("end")}
                className="rounded bg-rose-600/30 px-2 py-1 text-xs text-rose-200 hover:bg-rose-600/50"
              >
                + End
              </button>
              <button
                onClick={() =>
                  onSaveDialogue({
                    ...activeDialogue,
                    locked: !activeDialogue.locked,
                  })
                }
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${
                  activeDialogue.locked
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {activeDialogue.locked ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <Unlock className="h-3 w-3" />
                )}
                {activeDialogue.locked ? t.locked : t.unlocked}
              </button>
            </>
          )}
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_e, n) => setSelectedNodeId(n.id)}
          onNodeDragStop={handleNodeDragStop}
          onConnect={handleConnect}
          fitView
        >
          <Background color="#1e293b" gap={20} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Right Node Inspector */}
      <aside className="w-96 overflow-y-auto border-l border-slate-800 bg-slate-900/90 p-4">
        <h3 className="text-sm font-semibold text-slate-100">{t.dialogueInspector}</h3>
        {!selectedNode ? (
          <p className="mt-4 text-xs text-slate-400">{t.selectNodeHint}</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-indigo-300">
                {selectedNode.id} ({selectedNode.type})
              </span>
              <button
                onClick={() => handleDeleteNode(selectedNode.id)}
                className="inline-flex items-center gap-1 rounded bg-rose-950 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900"
              >
                <Trash2 className="h-3 w-3" />
                {t.delete}
              </button>
            </div>

            {selectedNode.type === "npc_line" && (
              <>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Speaker
                  <select
                    value={selectedNode.speaker_id ?? ""}
                    onChange={(e) =>
                      updateNode({
                        ...selectedNode,
                        speaker_id: e.target.value || undefined,
                      })
                    }
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
                  >
                    <option value="">—</option>
                    {bundle.characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} ({c.name[contentLocale] ?? c.id})
                      </option>
                    ))}
                  </select>
                </label>

                {bundle.game.locales.map((loc) => (
                  <label key={loc} className="flex flex-col gap-1 text-xs text-slate-400">
                    Line ({loc.toUpperCase()})
                    <textarea
                      rows={3}
                      value={selectedNode.text?.[loc] ?? ""}
                      onChange={(e) =>
                        updateNode({
                          ...selectedNode,
                          text: { ...(selectedNode.text ?? {}), [loc]: e.target.value },
                        })
                      }
                      className="rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-100"
                    />
                  </label>
                ))}
              </>
            )}

            {selectedNode.type === "player_choice" && (
              <div className="space-y-3">
                {(selectedNode.choices ?? []).map((ch, idx) => (
                  <div
                    key={ch.id}
                    className="space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-2.5"
                  >
                    <div className="flex items-center justify-between font-mono text-[11px] text-violet-300">
                      <span>{ch.id}</span>
                      <span>→ {ch.next_node_id ?? "—"}</span>
                    </div>
                    {bundle.game.locales.map((loc) => (
                      <input
                        key={loc}
                        placeholder={`${loc.toUpperCase()} choice text`}
                        value={ch.text[loc] ?? ""}
                        onChange={(e) => {
                          const nextChoices = [...(selectedNode.choices ?? [])];
                          nextChoices[idx] = {
                            ...ch,
                            text: { ...ch.text, [loc]: e.target.value },
                          };
                          updateNode({ ...selectedNode, choices: nextChoices });
                        }}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
