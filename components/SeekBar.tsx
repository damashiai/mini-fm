"use client";

import { useCallback, useRef } from "react";
import { formatTime } from "@/lib/utils";
import { usePlayer } from "./player-store";

export default function SeekBar({ compact = false }: { compact?: boolean }) {
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const buffered = usePlayer((s) => s.buffered);
  const track = duration > 0;
  const pct = track ? (currentTime / duration) * 100 : 0;
  const bufPct = track ? Math.min(100, (buffered / duration) * 100) : 0;
  const scrubbing = useRef(false);

  const seekTo = useCallback((clientX: number, el: HTMLInputElement) => {
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const t = ratio * (usePlayer.getState().duration || 0);
    document.dispatchEvent(new CustomEvent("minifm:seek", { detail: t }));
    usePlayer.getState().setTime(t);
  }, []);

  return (
    <div className={compact ? "" : "flex items-center gap-2"}>
      {!compact && (
        <span className="w-10 text-right text-xs tabular-nums text-muted">
          {formatTime(currentTime)}
        </span>
      )}
      {/* Single-bar stack on an inset line: the native thumb travels within
          (width − thumb), so the painted line is inset by half a thumb (8px)
          on each side — thumb center and bar ends stay aligned edge to edge.
          Red = played, lighter gray = loaded ahead. */}
      <div className="relative flex-1">
        <span className="absolute inset-x-2 top-1/2 block h-[5px] -translate-y-1/2">
          <span aria-hidden className="absolute inset-0 block rounded-full bg-[#3a3a3a]" />
          <span
            aria-hidden
            className="seek-buffered absolute inset-0 block rounded-full"
            style={{ "--buffered": `${bufPct}%` } as React.CSSProperties}
          />
          <span
            aria-hidden
            className="absolute left-0 top-0 block h-full rounded-full bg-brand"
            style={{ width: `${pct}%` }}
          />
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(duration || 1))}
          step={1}
          value={Math.floor(currentTime)}
          aria-label="Seek"
          className="seek relative z-10"
          style={{ "--fill": `${pct}%` } as React.CSSProperties}
          onChange={(e) => {
            const t = Number(e.target.value);
            document.dispatchEvent(new CustomEvent("minifm:seek", { detail: t }));
            usePlayer.getState().setTime(t);
          }}
          onPointerDown={(e) => {
            scrubbing.current = true;
            (e.target as HTMLInputElement).setPointerCapture(e.pointerId);
            seekTo(e.clientX, e.target as HTMLInputElement);
          }}
          onPointerMove={(e) => {
            if (scrubbing.current) seekTo(e.clientX, e.target as HTMLInputElement);
          }}
          onPointerUp={() => {
            scrubbing.current = false;
          }}
        />
      </div>
      {!compact && (
        <span className="w-10 text-xs tabular-nums text-muted">
          {formatTime(duration)}
        </span>
      )}
    </div>
  );
}
