"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Mic, Music2, X } from "lucide-react";
import { usePlayer } from "./player-store";
import { activeLineIndex, parseLrc } from "@/lib/lrclib";
import { NextButton, PlayPauseButton, PrevButton } from "./PlayerBar";
import SeekBar from "./SeekBar";
import { LyricsSkeleton } from "./Skeletons";

interface LyricsPayload {
  status: "synced" | "plain" | "instrumental" | "not-found";
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

/**
 * Full-screen lyrics overlay, redesigned for readability: large type,
 * generous spacing, current line in bright focus with a brand marker while
 * upcoming lines stay legible and past lines recede. Synced LRC auto-scrolls
 * against playback and any line tap seeks.
 *
 * States: instrumental → explicit card; synced → scrolling highlight;
 * plain / not-found → plain lyrics when available, else a clean empty state.
 */
export default function LyricsOverlay() {
  const open = usePlayer((s) => s.lyricsOpen);
  const setOpen = usePlayer((s) => s.setLyricsOpen);
  const current = usePlayer((s) => s.current());
  const currentTime = usePlayer((s) => s.currentTime);
  const [payload, setPayload] = useState<LyricsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  // Auto-follow: pauses the moment the user scrolls/touches the list
  // themselves; the pill button resumes it. Keeps motion smooth yet feelable.
  const [following, setFollowing] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setFollowing(true);
    // Lock the page behind the modal so only the lyrics list can scroll —
    // this also kills the "second scrollbar" bleed-through.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open ]);

  useEffect(() => {
    if (!open || !current) return;
    // Drop focus into the overlay root so Space toggles playback instead of
    // re-triggering whichever button opened it (or a tapped lyric line).
    (document.activeElement as HTMLElement | null)?.blur?.();
    setPayload(null);
    setLoading(true);
    fetch(`/api/lyrics?song=${encodeURIComponent(current.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setPayload(j))
      .catch(() => setPayload({ status: "not-found", plainLyrics: null, syncedLyrics: null }))
      .finally(() => setLoading(false));
  }, [open, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = useMemo(
    () => (payload?.syncedLyrics ? parseLrc(payload.syncedLyrics) : []),
    [payload],
  );
  const active = activeLineIndex(lines, currentTime);

  useEffect(() => {
    if (!open || active < 0 || !following) return;
    // Scroll ONLY the lyrics container: scrollIntoView() would also shift
    // every scrollable ancestor (page behind, header/footer with it).
    const container = listRef.current;
    const el = container?.querySelector(`[data-line="${active}"]`) as HTMLElement | null;
    if (!container || !el) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    container.scrollTo({
      top:
        container.scrollTop +
        (eRect.top - cRect.top) -
        container.clientHeight / 2 +
        eRect.height / 2,
      behavior: "smooth",
    });
  }, [active, open, following]);

  if (!open || !current) return null;

  const seekTo = (t: number) => {    document.dispatchEvent(new CustomEvent("minifm:seek", { detail: t }));
    usePlayer.getState().setTime(t);
    // A tap is an explicit jump — resume following from the new position.
    setFollowing(true);
    // Keep focus off the tapped line so Space keeps toggling playback.
    (document.activeElement as HTMLElement | null)?.blur?.();
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-ink">
      {/* Faint blurred cover backdrop for depth */}
      {current.coverArt && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current.coverArt}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-15 blur-3xl"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/60 via-transparent to-ink" />

      {/* Header */}
      <div className="relative flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {current.coverArt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.coverArt}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-cover shadow-lg"
            />
          ) : (
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white/10">
              <Music2 size={22} className="text-muted" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
              Lyrics
            </p>
            <p className="mt-0.5 truncate text-lg font-bold leading-tight">{current.title}</p>
            <p className="truncate text-sm text-muted">{current.artistNames}</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close lyrics"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/20"
        >
          <X size={14} /> Close
        </button>
      </div>

      {/* Body */}
      <div
        className="relative flex-1 overscroll-contain overflow-y-auto px-5 py-8 sm:px-10"
        ref={listRef}
        onWheel={() => setFollowing(false)}
        onTouchMove={() => setFollowing(false)}
      >
        {loading && <LyricsSkeleton />}

        {!loading && payload?.status === "instrumental" && (
          <div className="mx-auto max-w-md py-16 text-center">
            <AudioLines size={56} className="mx-auto text-muted" />
            <h2 className="mt-5 text-2xl font-extrabold">Instrumental track</h2>
            <p className="mt-3 text-base leading-relaxed text-muted">
              No vocals on this one — just press play and enjoy the music.
            </p>
          </div>
        )}

        {!loading && payload?.status === "synced" && (
          <div className="lyrics-scroll mx-auto max-w-2xl space-y-5 pb-28 text-center">
            {lines.map((l, i) => {
              const isActive = i === active;
              const isPast = i < active;
              return (
                <button
                  key={i}
                  data-line={i}
                  onClick={() => seekTo(l.time)}
                  className={`relative block w-full rounded-2xl px-4 py-2 text-[1.35rem] leading-snug transition-all duration-300 sm:text-3xl sm:leading-snug ${
                    isActive
                      ? "scale-[1.04] font-extrabold text-white"
                      : isPast
                        ? "font-medium text-muted/50"
                        : "font-semibold text-neutral-300"
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-brand shadow-[0_0_12px_#E50914]"
                    />
                  )}
                  {l.text}
                </button>
              );
            })}
          </div>
        )}

        {!loading &&
          (payload?.status === "plain" ||
            (payload?.status === "not-found" && payload?.plainLyrics)) && (
            <div className="mx-auto max-w-xl whitespace-pre-line pb-24 text-center text-lg leading-loose text-neutral-100 sm:text-xl">
              {payload?.plainLyrics}
            </div>
          )}

        {!loading && payload?.status === "not-found" && !payload?.plainLyrics && (
          <div className="mx-auto max-w-md py-16 text-center">
            <Mic size={56} className="mx-auto text-muted" />
            <h2 className="mt-5 text-2xl font-extrabold">No lyrics found</h2>
            <p className="mt-3 text-base leading-relaxed text-muted">
              We couldn&apos;t find synced or plain lyrics for this track yet.
            </p>
          </div>
        )}
      </div>

      {/* Resume-follow pill when the user scrolled away on their own */}
      {payload?.status === "synced" && !loading && !following && (
        <div className="pointer-events-none absolute inset-x-0 bottom-40 flex justify-center">
          <button
            onClick={() => setFollowing(true)}
            className="animate-rise pointer-events-auto rounded-full bg-white px-5 py-2 text-sm font-bold text-black shadow-2xl hover:scale-105"
          >
            Back to current line
          </button>
        </div>
      )}

      {/* Footer: transport + full seek control stay available in lyrics mode */}
      {payload?.status === "synced" && !loading && (
        <div className="relative border-t border-white/10 px-5 py-3">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-center gap-2 pb-1">
              <PrevButton />
              <PlayPauseButton />
              <NextButton />
            </div>
            <SeekBar />
            <p className="mt-1 text-center text-[11px] uppercase tracking-widest text-muted">
              Tap any line to jump
            </p>
          </div>
        </div>
      )}
      {/* Non-synced states still get transport + seek controls */}
      {(!payload || payload.status !== "synced" || loading) && (
        <div className="relative border-t border-white/10 px-5 py-3">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-center gap-2 pb-1">
              <PrevButton />
              <PlayPauseButton />
              <NextButton />
            </div>
            <SeekBar />
          </div>
        </div>
      )}
    </div>
  );
}
