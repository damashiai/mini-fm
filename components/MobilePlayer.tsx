"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePlayer } from "./player-store";
import SeekBar from "./SeekBar";
import CoverImage from "./CoverImage";
import { ChevronDown, FileText, Info, Music2 } from "lucide-react";
import { PlayPauseButton, PrevButton, NextButton, AudioErrorNote } from "./PlayerBar";
import LikeButton from "./LikeButton";

/**
 * Bottom-sheet mobile player: a docked mini-player that expands to a
 * full-screen view (large art, lyrics toggle, queue tab) on tap or swipe-up,
 * with swipe left/right to skip tracks.
 */
export default function MobilePlayer() {
  const current = usePlayer((s) => s.current());
  const expanded = usePlayer((s) => s.expanded);
  const setExpanded = usePlayer((s) => s.setExpanded);
  const setLyricsOpen = usePlayer((s) => s.setLyricsOpen);
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playAt = usePlayer((s) => s.playAt);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const touch = useRef<{ x: number; y: number } | null>(null);

  if (!current) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]!;
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const t = e.changedTouches[0]!;
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 40 && Math.abs(dy) < 40) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next();
      else prev();
    } else if (!expanded && dy < -60) {
      setExpanded(true);
    } else if (expanded && dy > 60) {
      setExpanded(false);
    }
  };

  return (
    <>
      {/* Mini-player dock */}
      {!expanded && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-coal shadow-[0_-8px_30px_rgba(0,0,0,0.55)] md:hidden">
          <SeekBar compact />
          <div
            role="button"
            tabIndex={0}
            aria-label="Open full player"
            className="flex w-full cursor-pointer items-center gap-3 px-3 pb-3 pt-1 text-left"
            onClick={() => setExpanded(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setExpanded(true);
            }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {current.coverArt ? (
              <CoverImage src={current.coverArt} alt={current.title} className="h-11 w-11 rounded-md" />
            ) : (
              <div className="grid h-11 w-11 place-items-center rounded-md bg-card text-muted">
                <Music2 size={20} />
              </div>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{current.title}</span>
              <span className="block truncate text-xs text-muted">{current.artistNames}</span>
            </span>
            <span className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
              <button
                aria-label="Open lyrics"
                title="Lyrics"
                onClick={() => setLyricsOpen(true)}
                className="rounded-full p-2 text-muted hover:bg-card hover:text-white"
              >
                <FileText size={18} />
              </button>
              <Link
                href={`/song/${current.id}`}
                aria-label="Open details"
                title="Details"
                onClick={(e) => e.stopPropagation()}
                className="rounded-full p-2 text-muted hover:bg-card hover:text-white"
              >
                <Info size={18} />
              </Link>
              <PlayPauseButton />
            </span>
          </div>
        </div>
      )}

      {/* Expanded full-screen view */}
      {expanded && (
        <div
          className="animate-rise fixed inset-0 z-50 flex flex-col bg-ink md:hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setExpanded(false)}
              aria-label="Collapse player"
              className="rounded-full bg-card p-2"
            >
              <ChevronDown size={18} />
            </button>
            <span className="text-xs uppercase tracking-widest text-muted">Now playing</span>
            <LikeButton songId={current.id} />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6">
            {current.coverArt ? (
              <CoverImage
                src={current.coverArt}
                alt={current.title}
                eager
                className="aspect-square w-full max-w-xs rounded-2xl shadow-2xl"
              />
            ) : (
              <div className="grid aspect-square w-full max-w-xs place-items-center rounded-2xl bg-card text-muted">
                <Music2 size={64} />
              </div>
            )}
            <div className="text-center">
              <div className="text-xl font-bold">{current.title}</div>
              <div className="text-sm text-muted">{current.artistNames}</div>
              <AudioErrorNote className="mt-1 px-4 text-center" />
            </div>
            <div className="w-full">
              <SeekBar />
            </div>
            <div className="flex items-center gap-6">
              <PrevButton />
              <PlayPauseButton big />
              <NextButton />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLyricsOpen(true)}
                className="rounded-full bg-card px-4 py-2 text-sm font-medium"
              >
                Lyrics
              </button>
              <Link
                href={`/song/${current.id}`}
                onClick={() => setExpanded(false)}
                className="rounded-full bg-card px-4 py-2 text-sm font-medium"
              >
                Details
              </Link>
            </div>
          </div>
          {/* Queue tab */}
          <div className="max-h-48 overflow-y-auto border-t border-line px-4 py-2">
            <div className="py-1 text-xs font-semibold uppercase tracking-widest text-muted">
              Up next
            </div>
            {queue.slice(index + 1, index + 8).map((q) => (
              <button
                key={q.queueKey}
                onClick={() => playAt(queue.indexOf(q))}
                className="flex w-full items-center gap-2 py-1.5 text-left text-sm"
              >
                <span className="flex-1 truncate">
                  {q.title} <span className="text-muted">— {q.artistNames}</span>
                </span>
              </button>
            ))}
            {queue.length <= index + 1 && (
              <p className="py-2 text-xs text-muted">
                Similar tracks will keep playing automatically.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
