import { useState } from "react";
import { Check, Lock, X } from "lucide-react";
import type { AiProposal, ProposalItem } from "@studio-ui/shared";
import { dict, type UiLocale } from "../i18n";

interface Props {
  proposal: AiProposal;
  uiLocale: UiLocale;
  onApply: (selected: ProposalItem[]) => Promise<void>;
  onClose: () => void;
}

export function ProposalModal({ proposal, uiLocale, onApply, onClose }: Props) {
  const t = dict[uiLocale];
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(proposal.items.filter((i) => !i.locked).map((i) => i.key))
  );
  const [applying, setApplying] = useState(false);

  const toggle = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const chosen = proposal.items.filter(
        (i) => !i.locked && selectedKeys.has(i.key)
      );
      await onApply(chosen);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs dark:bg-black/70">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#15181e]">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {t.proposalTitle}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Model: <span className="font-mono">{proposal.model}</span> — {proposal.summary}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {proposal.items.map((item) => {
            const checked = !item.locked && selectedKeys.has(item.key);
            return (
              <div
                key={item.key}
                className={`rounded-xl border p-3.5 ${
                  item.locked
                    ? "border-amber-200 bg-amber-50/70 opacity-80 dark:border-amber-500/30 dark:bg-amber-950/20"
                    : "border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-950/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    <input
                      type="checkbox"
                      disabled={item.locked}
                      checked={checked}
                      onChange={() => toggle(item.key)}
                      className="h-4 w-4 accent-blue-600"
                    />
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-[11px] uppercase text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                      {item.entity_type}
                    </span>
                    <span className="font-mono text-xs">{item.entity_id}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      ({item.action})
                    </span>
                  </label>
                  {item.locked && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                      <Lock className="h-3.5 w-3.5" />
                      {t.proposalLockedNote}
                    </span>
                  )}
                </div>
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-zinc-200 bg-white p-2.5 font-mono text-[11px] text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                  {JSON.stringify(item.data, null, 2)}
                </pre>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {t.proposalCancel}
          </button>
          <button
            onClick={handleApply}
            disabled={applying || selectedKeys.size === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <Check className="h-3.5 w-3.5" />
            {t.proposalApply} ({selectedKeys.size})
          </button>
        </div>
      </div>
    </div>
  );
}
