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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">{t.proposalTitle}</h3>
            <p className="text-xs text-slate-400">
              Model: <span className="font-mono">{proposal.model}</span> — {proposal.summary}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {proposal.items.map((item) => {
            const checked = !item.locked && selectedKeys.has(item.key);
            return (
              <div
                key={item.key}
                className={`rounded-xl border p-3 ${
                  item.locked
                    ? "border-amber-500/30 bg-amber-950/20 opacity-75"
                    : "border-slate-800 bg-slate-950/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-100">
                    <input
                      type="checkbox"
                      disabled={item.locked}
                      checked={checked}
                      onChange={() => toggle(item.key)}
                      className="h-4 w-4 accent-indigo-500"
                    />
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] uppercase text-indigo-300">
                      {item.entity_type}
                    </span>
                    <span className="font-mono text-xs">{item.entity_id}</span>
                    <span className="text-xs text-slate-400">({item.action})</span>
                  </label>
                  {item.locked && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                      <Lock className="h-3.5 w-3.5" />
                      {t.proposalLockedNote}
                    </span>
                  )}
                </div>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-900 p-2 font-mono text-[11px] text-slate-300">
                  {JSON.stringify(item.data, null, 2)}
                </pre>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
          >
            {t.proposalCancel}
          </button>
          <button
            onClick={handleApply}
            disabled={applying || selectedKeys.size === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {t.proposalApply} ({selectedKeys.size})
          </button>
        </div>
      </div>
    </div>
  );
}
