"use client";

import Link from "next/link";
import { useState } from "react";
import { Music2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { usePlayer } from "./player-store";
import SeekBar from "./SeekBar";
import CoverImage from "./CoverImage";

function Art({ src, title, size }: { src: string | null; title: string; size: string }) {
  const buffering = usePlayer((s) => s.buffering);
  if (src) {
    return (
      <span className={`relative block ${size}`}>
        <CoverImage src={src} alt={title} className={`${size} rounded-md`} />
        {buffering && (
          <span className="absolute inset-0 grid place-items-center rounded-md bg-black/40">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </span>
        )}
      </span>
    );
  }
  return (
    <div className={`${size} grid place-items-center rounded-md bg-card text-muted`}>
      <Music2 size={20} />
    </div>
  );
}

export function PlayPauseButton({ big = false }: { big?: boolean }) {
  const isPlaying = usePlayer((s) => s.isPlaying);
  const buffering = usePlayer((s) => s.buffering);
  const setPlaying = usePlayer((s) => s.setPlaying);
  return (
    <button
      aria-label={buffering ? "Loading audio" : isPlaying ? "Pause" : "Play"}
      onClick={() => setPlaying(!isPlaying)}
      className={`grid place-items-center rounded-full bg-white text-black transition hover:scale-105 ${
        big ? "h-14 w-14 text-2xl" : "h-9 w-9 text-base"
      }`}
    >
      {buffering ? (
        <span
          aria-hidden
          className={`animate-spin rounded-full border-2 border-black/25 border-t-black ${
            big ? "h-6 w-6" : "h-4 w-4"
          }`}
        />
      ) : isPlaying ? (
        <Pause size={big ? 26 : 16} fill="currentColor" />
      ) : (
        <Play size={big ? 26 : 16} fill="currentColor" className="ml-0.5" />
      )}
    </button>
  );
}

/** Inline playback-failure note shared by desktop + mobile players. */
export function AudioErrorNote({ className = "" }: { className?: string }) {
  const audioError = usePlayer((s) => s.audioError);
  if (!audioError) return null;
  return <p className={`text-[11px] leading-snug text-red-400 ${className}`}>{audioError}</p>;
}

function VolumeControl() {
  const volume = usePlayer((s) => s.volume);
  const setVolume = usePlayer((s) => s.setVolume);
  const muted = usePlayer((s) => s.muted);
  const setMuted = usePlayer((s) => s.setMuted);
  const [show, setShow] = useState(false);
  const pct = muted ? 0 : Math.round(volume * 100);
  // Bubble stays inside the control at the extremes.
  const bubblePct = Math.min(90, Math.max(10, pct));
  return (
    <span
      className="hidden h-6 items-center gap-2 xl:flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <button
        onClick={() => setMuted(!muted)}
        className="shrink-0 text-muted hover:text-white"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <span className="relative block h-6 w-24">
        {show && (
          <span
            aria-hidden
            className="absolute -top-7 whitespace-nowrap rounded-md border border-line bg-ink px-1.5 py-0.5 text-[11px] tabular-nums text-white shadow-lg"
            style={{ left: `${bubblePct}%`, transform: "translateX(-50%)" }}
          >
            {pct}%
          </span>
        )}
        <span className="absolute inset-x-2 top-1/2 block h-[5px] -translate-y-1/2">
          <span aria-hidden className="absolute inset-0 block rounded-full bg-[#3a3a3a]" />
          <span
            aria-hidden
            className="absolute left-0 top-0 block h-full rounded-full bg-brand"
            style={{ width: `${pct}%` }}
          />
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => {
            setVolume(Number(e.target.value) / 100);
            if (muted) setMuted(false);
          }}
          onPointerDown={() => setShow(true)}
          onPointerUp={() => setShow(false)}
          onFocus={() => setShow(true)}
          onBlur={() => setShow(false)}
          className="seek relative z-10"
          aria-label={`Volume ${pct} percent`}
        />
      </span>
    </span>
  );
}

export function PrevButton() {
  const prev = usePlayer((s) => s.prev);
  return (
    <button aria-label="Previous" onClick={prev} className="px-2 text-muted hover:text-white">
      <SkipBack size={20} fill="currentColor" />
    </button>
  );
}

export function NextButton() {
  const next = usePlayer((s) => s.next);
  return (
    <button aria-label="Next" onClick={next} className="px-2 text-muted hover:text-white">
      <SkipForward size={20} fill="currentColor" />
    </button>
  );
}

/** Docked desktop bar. Hidden when nothing has ever been queued. */
export default function PlayerBar() {
  const current = usePlayer((s) => s.current());
  const setQueueOpen = usePlayer((s) => s.setQueueOpen);
  const setLyricsOpen = usePlayer((s) => s.setLyricsOpen);
  const queueOpen = usePlayer((s) => s.queueOpen);
  const queue = usePlayer((s) => s.queue);

  if (!current) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-line bg-coal shadow-[0_-8px_30px_rgba(0,0,0,0.55)] md:block">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_1.4fr_1fr] items-center gap-4 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <Art src={current.coverArt} title={current.title} size="h-12 w-12" />
          <div className="min-w-0">
            <Link href={`/song/${current.id}`} className="block truncate text-sm font-semibold hover:underline">
              {current.title}
            </Link>
            <div className="truncate text-xs text-muted">{current.artistNames}</div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center justify-center gap-1">
            <PrevButton />
            <span className="mx-1">
              <PlayPauseButton />
            </span>
            <NextButton />
          </div>
          <SeekBar />
          <AudioErrorNote className="mt-0.5 text-center" />
        </div>
        <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
          <button
            onClick={() => setLyricsOpen(true)}
            className="whitespace-nowrap rounded-md px-2 py-1 text-xs text-muted hover:bg-card hover:text-white"
            title="Lyrics"
          >
            Lyrics
          </button>
          <button
            onClick={() => setQueueOpen(!queueOpen)}
            className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium hover:text-white ${
              queueOpen ? "bg-line text-white" : "bg-card text-muted"
            }`}
            title="Up next queue"
          >
            Up next · {queue.length}
          </button>
          <VolumeControl />
        </div>
      </div>
    </div>
  );
}
