"use client";

import { Play } from "lucide-react";
import type { Track } from "@/lib/db-types";
import { usePlayer } from "./player-store";

/** Big "play this context" button for detail pages. */
export function PlayAllButton({ tracks, label = "Play all" }: { tracks: Track[]; label?: string }) {
  const playTracks = usePlayer((s) => s.playTracks);
  if (tracks.length === 0) return null;
  return (
    <button
      onClick={() => playTracks(tracks)}
      className="flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-bold hover:bg-brandDark"
    >
      <Play size={15} fill="currentColor" /> {label}
    </button>
  );
}

/** Opens the full-screen lyrics overlay for the current queue context. */
export function LyricsEntryButton({ track }: { track: Track }) {
  const playTracks = usePlayer((s) => s.playTracks);
  const setLyricsOpen = usePlayer((s) => s.setLyricsOpen);
  const current = usePlayer((s) => s.current());
  return (
    <button
      onClick={() => {
        // Ensure the song page's track is what's playing so lyrics sync.
        if (current?.id !== track.id) playTracks([track]);
        setLyricsOpen(true);
      }}
      className="rounded-full border border-line px-6 py-2.5 text-sm font-semibold hover:bg-card"
    >
      Lyrics
    </button>
  );
}
