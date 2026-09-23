"use client";

import { ChevronDown, ChevronUp, Play, X } from "lucide-react";
import { usePlayer } from "./player-store";
import { formatTime } from "@/lib/utils";

/** Reorderable up-next panel (desktop slide-over). */
export default function QueuePanel() {
  const open = usePlayer((s) => s.queueOpen);
  const setOpen = usePlayer((s) => s.setQueueOpen);
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playAt = usePlayer((s) => s.playAt);
  const remove = usePlayer((s) => s.removeFromQueue);
  const move = usePlayer((s) => s.moveInQueue);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 hidden md:block">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
      <aside className="absolute right-0 top-0 flex h-full w-96 flex-col border-l border-line bg-coal">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-bold">Up next</h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close queue"
            className="rounded-full bg-card p-1.5"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {queue.length === 0 && (
            <p className="p-4 text-sm text-muted">Queue is empty.</p>
          )}
          {queue.map((q, i) => (
            <div
              key={q.queueKey}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                i === index ? "bg-card" : "hover:bg-card/60"
              }`}
            >
              <button onClick={() => playAt(i)} className="min-w-0 flex-1 text-left">
                <span className="flex items-center gap-1.5 truncate text-sm">
                  {i === index && <Play size={12} fill="currentColor" className="shrink-0 text-brand" />}
                  <span className="truncate">{q.title}</span>
                </span>
                <span className="block truncate text-xs text-muted">
                  {q.artistNames} · {formatTime(q.duration)}
                </span>
              </button>
              <span className="flex shrink-0 gap-0.5">
                <button
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="rounded p-0.5 text-muted hover:text-white disabled:opacity-30"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  aria-label="Move down"
                  disabled={i === queue.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="rounded p-0.5 text-muted hover:text-white disabled:opacity-30"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  aria-label="Remove"
                  onClick={() => remove(q.queueKey)}
                  className="rounded p-0.5 text-muted hover:text-white"
                >
                  <X size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
