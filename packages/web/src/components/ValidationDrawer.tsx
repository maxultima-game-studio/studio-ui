import { AlertTriangle, Sparkles, X, CheckCircle2 } from "lucide-react";
import type { ValidationIssue } from "@studio-ui/shared";
import { dict, type UiLocale } from "../i18n";

export interface AiAuditFinding {
  severity: "error" | "warning" | "suggestion";
  title: { cs: string; en: string };
  detail: { cs: string; en: string };
}

interface Props {
  open: boolean;
  issues: ValidationIssue[];
  aiFindings: AiAuditFinding[];
  aiBusy: boolean;
  uiLocale: UiLocale;
  onRunAiAudit: () => Promise<void>;
  onClose: () => void;
}

export function ValidationDrawer({
  open,
  issues,
  aiFindings,
  aiBusy,
  uiLocale,
  onRunAiAudit,
  onClose,
}: Props) {
  if (!open) return null;
  const t = dict[uiLocale];

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#15181e]">
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t.validationTitle}
        </h3>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <button
          onClick={onRunAiAudit}
          disabled={aiBusy}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {aiBusy ? t.aiWorking : t.aiReviewLogic}
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/20 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {t.noIssues}
          </div>
        ) : (
          issues.map((issue) => (
            <div
              key={issue.id}
              className={`rounded-xl border p-3 text-xs ${
                issue.severity === "error"
                  ? "border-rose-200 bg-rose-50/70 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-200"
                  : "border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200"
              }`}
            >
              <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase">
                <AlertTriangle className="h-3.5 w-3.5" />
                {issue.code} ({issue.entity_type}:{issue.entity_id})
              </div>
              <p className="mt-1">{issue.message[uiLocale] ?? issue.message.en}</p>
            </div>
          ))
        )}

        {aiFindings.length > 0 && (
          <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              AI Audit
            </div>
            {aiFindings.map((f, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-zinc-800 dark:border-blue-500/30 dark:bg-blue-950/20 dark:text-zinc-200"
              >
                <div className="font-semibold text-blue-800 dark:text-blue-300">
                  [{f.severity.toUpperCase()}] {f.title[uiLocale] ?? f.title.en}
                </div>
                <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                  {f.detail[uiLocale] ?? f.detail.en}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
