import { useEffect, useRef, useState } from "react";
import {
  Bell,
  MessageSquareCode,
  Pin,
  PinOff,
  Trash2,
  X,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Info,
  GripHorizontal,
} from "lucide-react";
import type { AiLogEntry, FloatingWindowPref } from "../api";
import type { UiLocale } from "../i18n";

export interface NotificationItem {
  id: string;
  timestamp: string;
  severity: "info" | "success" | "error";
  message: string;
}

interface Props {
  uiLocale: UiLocale;
  gameSlug: string;
  activeModelLabel: string;
  notifications: NotificationItem[];
  aiLogs: AiLogEntry[];
  notifWin: FloatingWindowPref;
  chatWin: FloatingWindowPref;
  onChangeNotifWin: (next: FloatingWindowPref) => void;
  onChangeChatWin: (next: FloatingWindowPref) => void;
  onClearNotifications: () => void;
  onRefreshAiLogs: () => Promise<void>;
  onClearAiLogs: () => Promise<void>;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function clampRect(r: FloatingWindowPref): FloatingWindowPref {
  const maxW = Math.max(300, window.innerWidth - 24);
  const maxH = Math.max(220, window.innerHeight - 96);
  const w = Math.min(maxW, Math.max(300, r.w));
  const h = Math.min(maxH, Math.max(220, r.h));
  const x = Math.min(Math.max(8, window.innerWidth - w - 8), Math.max(8, r.x));
  const y = Math.min(Math.max(60, window.innerHeight - h - 44), Math.max(60, r.y));
  return { ...r, x, y, w, h };
}

function FormattedAiResponse({ text }: { text: string }) {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (typeof parsed.pitch === "string") {
      return (
        <div className="space-y-1.5">
          {typeof parsed.rationale === "string" && parsed.rationale && (
            <div className="rounded-lg bg-blue-50/80 px-2 py-1 text-[11px] italic text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
              {parsed.rationale}
            </div>
          )}
          <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-800 dark:text-zinc-200">
            {parsed.pitch}
          </div>
        </div>
      );
    }
    return (
      <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100/80 p-2 font-mono text-[10.5px] leading-relaxed text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    );
  } catch {
    return (
      <div className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-zinc-800 dark:text-zinc-200">
        {text}
      </div>
    );
  }
}

function FloatingToolWindow({
  title,
  icon,
  win,
  isCs,
  zIndex,
  onFocus,
  onChange,
  headerActions,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  win: FloatingWindowPref;
  isCs: boolean;
  zIndex: number;
  onFocus: () => void;
  onChange: (next: FloatingWindowPref) => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const safe = clampRect(win);

  const startDrag = (e: React.MouseEvent) => {
    if (!win.pinned) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    onFocus();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = safe.x;
    const origY = safe.y;

    const onMove = (ev: MouseEvent) => {
      onChange(
        clampRect({
          ...win,
          x: origX + (ev.clientX - startX),
          y: origY + (ev.clientY - startY),
        })
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startResize = (
    e: React.MouseEvent,
    corner: "tl" | "br"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...safe };

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (corner === "br") {
        onChange(
          clampRect({
            ...win,
            x: orig.x,
            y: orig.y,
            w: orig.w + dx,
            h: orig.h + dy,
          })
        );
      } else {
        const nextW = Math.max(300, orig.w - dx);
        const nextH = Math.max(220, orig.h - dy);
        onChange(
          clampRect({
            ...win,
            x: orig.x + (orig.w - nextW),
            y: orig.y + (orig.h - nextH),
            w: nextW,
            h: nextH,
          })
        );
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      onMouseDown={onFocus}
      style={{
        left: safe.x,
        top: safe.y,
        width: safe.w,
        height: safe.h,
        zIndex,
      }}
      className="fixed flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#15181e]"
    >
      {/* Top-left resize handle */}
      <div
        onMouseDown={(e) => startResize(e, "tl")}
        title={isCs ? "Tažením změň velikost" : "Drag to resize"}
        className="absolute left-0 top-0 z-20 h-3.5 w-3.5 cursor-nwse-resize rounded-br-md bg-zinc-200/70 hover:bg-blue-500/60 dark:bg-zinc-700/70"
      />

      {/* Header (draggable when pinned) */}
      <div
        onMouseDown={startDrag}
        className={`flex select-none items-center justify-between border-b border-zinc-200 py-2 pl-4 pr-2.5 dark:border-zinc-800 ${
          win.pinned ? "cursor-move" : ""
        }`}
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          {win.pinned && (
            <GripHorizontal className="h-3.5 w-3.5 text-zinc-400" />
          )}
          {icon}
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {headerActions}
          <button
            onClick={() => onChange({ ...win, pinned: !win.pinned })}
            title={
              win.pinned
                ? isCs
                  ? "Odepnout okno"
                  : "Unpin window"
                : isCs
                ? "Připnout (půjde přesouvat i měnit velikost)"
                : "Pin (enables dragging & stays on screen)"
            }
            className={`rounded-full p-1 transition ${
              win.pinned
                ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {win.pinned ? (
              <Pin className="h-3.5 w-3.5" />
            ) : (
              <PinOff className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => onChange({ ...win, open: false })}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {children}

      {/* Bottom-right resize handle */}
      <div
        onMouseDown={(e) => startResize(e, "br")}
        title={isCs ? "Tažením změň velikost" : "Drag to resize"}
        className="absolute bottom-0 right-0 z-20 h-3.5 w-3.5 cursor-nwse-resize rounded-tl-md bg-zinc-200/70 hover:bg-blue-500/60 dark:bg-zinc-700/70"
      />
    </div>
  );
}

export function BottomDock({
  uiLocale,
  gameSlug,
  activeModelLabel,
  notifications,
  aiLogs,
  notifWin,
  chatWin,
  onChangeNotifWin,
  onChangeChatWin,
  onClearNotifications,
  onRefreshAiLogs,
  onClearAiLogs,
}: Props) {
  const isCs = uiLocale === "cs";
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [topWin, setTopWin] = useState<"notif" | "chat">("chat");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatWin.open && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatWin.open, aiLogs]);

  const copyText = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const errorCount = notifications.filter((n) => n.severity === "error").length;
  const hasUnpinnedOpen =
    (notifWin.open && !notifWin.pinned) || (chatWin.open && !chatWin.pinned);

  return (
    <>
      {hasUnpinnedOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            if (notifWin.open && !notifWin.pinned) {
              onChangeNotifWin({ ...notifWin, open: false });
            }
            if (chatWin.open && !chatWin.pinned) {
              onChangeChatWin({ ...chatWin, open: false });
            }
          }}
        />
      )}

      {/* Notifications Window (Pinnable, Draggable, Resizable) */}
      {notifWin.open && (
        <FloatingToolWindow
          title={`${isCs ? "Notifikace & chyby" : "Notifications & Errors"} (${notifications.length})`}
          icon={<Bell className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
          win={notifWin}
          isCs={isCs}
          zIndex={topWin === "notif" ? 45 : 40}
          onFocus={() => setTopWin("notif")}
          onChange={onChangeNotifWin}
          headerActions={
            <button
              onClick={onClearNotifications}
              title={isCs ? "Vymazat historii" : "Clear history"}
              className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          }
        >
          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-[11px]">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-[11px] text-zinc-400">
                {isCs ? "Zatím žádné notifikace." : "No notifications yet."}
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-xl border p-2.5 text-[11px] ${
                    n.severity === "error"
                      ? "border-rose-200 bg-rose-50/70 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200"
                      : n.severity === "success"
                      ? "border-emerald-200 bg-emerald-50/60 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/20 dark:text-emerald-200"
                      : "border-zinc-200 bg-zinc-50/70 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] opacity-80">
                      {n.severity === "error" ? (
                        <AlertCircle className="h-3 w-3" />
                      ) : n.severity === "success" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Info className="h-3 w-3" />
                      )}
                      {formatTime(n.timestamp)}
                    </span>
                    <button
                      onClick={() => copyText(n.id, `[${n.timestamp}] ${n.message}`)}
                      title={isCs ? "Kopírovat" : "Copy"}
                      className="rounded p-0.5 opacity-60 hover:opacity-100"
                    >
                      {copiedId === n.id ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 select-text break-words leading-snug">
                    {n.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </FloatingToolWindow>
      )}

      {/* AI Communication Chat Window (Pinnable, Draggable, Resizable) */}
      {chatWin.open && (
        <FloatingToolWindow
          title={`${isCs ? "AI komunikace" : "AI Communication"} (${aiLogs.length})`}
          icon={
            <MessageSquareCode className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          }
          win={chatWin}
          isCs={isCs}
          zIndex={topWin === "chat" ? 45 : 40}
          onFocus={() => setTopWin("chat")}
          onChange={onChangeChatWin}
          headerActions={
            <>
              <button
                onClick={() => void onRefreshAiLogs()}
                title={isCs ? "Obnovit" : "Refresh"}
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => void onClearAiLogs()}
                title={isCs ? "Vymazat historii" : "Clear history"}
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          }
        >
          <div
            ref={chatScrollRef}
            className="flex-1 space-y-4 overflow-y-auto bg-[#f8f9fb] p-3.5 text-[11px] dark:bg-[#0d0f12]"
          >
            {aiLogs.length === 0 ? (
              <p className="py-10 text-center text-[11px] text-zinc-400">
                {isCs
                  ? "Zatím neproběhla žádná komunikace s AI."
                  : "No AI exchanges recorded yet."}
              </p>
            ) : (
              aiLogs.map((log) => (
                <div key={log.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-zinc-400">
                    <span className="font-mono">{formatTime(log.timestamp)}</span>
                    <span>•</span>
                    <span className="rounded-full bg-zinc-200/80 px-1.5 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {log.action}
                    </span>
                    <span className="font-mono">
                      {log.providerName} / {log.model}
                    </span>
                    {log.status !== "pending" && (
                      <span>({(log.durationMs / 1000).toFixed(1)}s)</span>
                    )}
                  </div>

                  {/* Prompt bubble */}
                  <div className="flex justify-end">
                    <div className="max-w-[88%] rounded-2xl rounded-br-sm border border-blue-200/80 bg-blue-50/90 px-3 py-2 text-zinc-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-zinc-100">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                        <span>Prompt</span>
                        <button
                          onClick={() => copyText(`${log.id}-u`, log.userPrompt)}
                          className="opacity-60 hover:opacity-100"
                        >
                          {copiedId === `${log.id}-u` ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <div className="max-h-36 overflow-auto whitespace-pre-wrap break-words font-mono text-[10.5px] leading-relaxed">
                        {log.userPrompt}
                      </div>
                      <details className="mt-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <summary className="cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200">
                          System prompt
                        </summary>
                        <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded bg-white/70 p-1.5 font-mono text-[10px] dark:bg-zinc-950/70">
                          {log.systemPrompt}
                        </pre>
                      </details>
                    </div>
                  </div>

                  {/* AI response bubble */}
                  <div className="flex justify-start">
                    <div
                      className={`max-w-[92%] rounded-2xl rounded-bl-sm border px-3 py-2 ${
                        log.status === "error"
                          ? "border-rose-200 bg-rose-50/90 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200"
                          : log.status === "pending"
                          ? "border-blue-200/80 bg-white text-zinc-700 dark:border-blue-900/50 dark:bg-[#15181e] dark:text-zinc-300"
                          : "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-[#15181e] dark:text-zinc-100"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold">
                        <span
                          className={
                            log.status === "error"
                              ? "text-rose-700 dark:text-rose-300"
                              : log.status === "pending"
                              ? "inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400"
                              : "text-emerald-700 dark:text-emerald-400"
                          }
                        >
                          {log.status === "pending" && (
                            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-blue-500" />
                          )}
                          {log.model} •{" "}
                          {log.status === "pending"
                            ? isCs
                              ? "GENERUJI…"
                              : "GENERATING…"
                            : log.status.toUpperCase()}
                        </span>
                        {log.status !== "pending" && (
                          <button
                            onClick={() =>
                              copyText(
                                `${log.id}-a`,
                                log.responseText ?? log.error ?? ""
                              )
                            }
                            className="opacity-60 hover:opacity-100"
                          >
                            {copiedId === `${log.id}-a` ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                      {log.status === "pending" ? (
                        <p className="animate-pulse text-[11px] text-zinc-500 dark:text-zinc-400">
                          {isCs
                            ? "Čekám na odpověď modelu…"
                            : "Waiting for model response…"}
                        </p>
                      ) : log.status === "error" ? (
                        <p className="select-text break-words font-mono text-[10.5px]">
                          {log.error}
                        </p>
                      ) : (
                        <FormattedAiResponse text={log.responseText ?? ""} />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </FloatingToolWindow>
      )}

      {/* Fixed Bottom Status & Menu Bar */}
      <footer className="fixed inset-x-0 bottom-0 z-30 flex h-9 items-center justify-between border-t border-zinc-200/80 bg-white/95 px-4 text-[11px] text-zinc-500 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#15181e]/95 dark:text-zinc-400">
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span>{gameSlug || "—"}</span>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span>{activeModelLabel}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setTopWin("notif");
              onChangeNotifWin({ ...notifWin, open: !notifWin.open });
            }}
            title={isCs ? "Historie notifikací a chyb" : "Notifications & error history"}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
              notifWin.open
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : errorCount > 0
                ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            <span>{notifications.length}</span>
          </button>

          <button
            onClick={() => {
              setTopWin("chat");
              onChangeChatWin({ ...chatWin, open: !chatWin.open });
              void onRefreshAiLogs();
            }}
            title={isCs ? "AI komunikace (prompty & odpovědi)" : "AI communication log"}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
              chatWin.open
                ? "bg-blue-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <MessageSquareCode className="h-3.5 w-3.5" />
            <span>{aiLogs.length}</span>
          </button>
        </div>
      </footer>
    </>
  );
}
