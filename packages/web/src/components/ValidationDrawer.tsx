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
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-slate-800 bg-slate-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-100">{t.validationTitle}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-slate-800 p-3">
        <button
          onClick={onRunAiAudit}
          disabled={aiBusy}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {aiBusy ? t.aiWorking : t.aiReviewLogic}
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {t.noIssues}
          </div>
        ) : (
          issues.map((issue) => (
            <div
              key={issue.id}
              className={`rounded-lg border p-3 text-xs ${
                issue.severity === "error"
                  ? "border-rose-500/40 bg-rose-950/30 text-rose-200"
                  : "border-amber-500/40 bg-amber-950/30 text-amber-200"
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
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
              AI Audit
            </div>
            {aiFindings.map((f, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-3 text-xs text-slate-200"
              >
                <div className="font-semibold text-indigo-200">
                  [{f.severity.toUpperCase()}] {f.title[uiLocale] ?? f.title.en}
                </div>
                <p className="mt-1 text-slate-300">
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
