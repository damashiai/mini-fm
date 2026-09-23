"use client";

import { create } from "zustand";
import type { Track } from "@/lib/db-types";
import { getSessionId } from "@/lib/session";

export interface QueueItem extends Track {
  queueKey: string;
}

let keyCounter = 0;
function toQueueItems(tracks: Track[]): QueueItem[] {
  return tracks.map((t) => ({ ...t, queueKey: `${t.id}-${Date.now()}-${keyCounter++}` }));
}

interface PlayerState {
  queue: QueueItem[];
  index: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  queueOpen: boolean;
  lyricsOpen: boolean;
  expanded: boolean; // mobile full-screen view
  buffering: boolean; // signed URL fetch / audio rebuffering in progress
  audioError: string | null; // last load/playback failure, cleared on retry
  contextGenres: string[]; // genre slugs of the current context (auto-continue)
  playedSessionIds: string[]; // song ids already played this session (auto-continue exclusion)

  current: () => QueueItem | null;
  playTracks: (tracks: Track[], startIndex?: number, contextGenres?: string[], record?: boolean) => void;
  /** Silent queue load for restores: never touches isPlaying, never records. */
  loadQueue: (tracks: Track[], index?: number) => void;
  /** Metadata-only refresh: swaps track data, keeps position/playing state. */
  loadQueueSilentRefresh: (items: QueueItem[]) => void;
  addToQueue: (track: Track, next?: boolean) => void;
  removeFromQueue: (queueKey: string) => void;
  moveInQueue: (from: number, to: number) => void;
  clearEnded: () => void;
  next: () => void;
  prev: () => void;
  playAt: (index: number) => void;
  setPlaying: (playing: boolean) => void;
  setTime: (t: number, d?: number, buffered?: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setQueueOpen: (open: boolean) => void;
  setLyricsOpen: (open: boolean) => void;
  setExpanded: (open: boolean) => void;
  setBuffering: (b: boolean) => void;
  setAudioError: (msg: string | null) => void;
}

export const usePlayer = create<PlayerState>()((set, get) => ({
  queue: [],
  index: 0,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  buffered: 0,
  volume: 0.9,
  muted: false,
  queueOpen: false,
  lyricsOpen: false,
  expanded: false,
  buffering: false,
  audioError: null,
  contextGenres: [],
  playedSessionIds: [],

  current: () => {
    const { queue, index } = get();
    return queue[index] ?? null;
  },

  playTracks: (tracks, startIndex = 0, contextGenres = [], record = true) => {
    if (tracks.length === 0) return;
    const st = get();
    const cur = st.queue[st.index] ?? null;
    // Clicking the currently-playing song is a no-op (no restart); if it's
    // paused, just resume instead of restarting from zero.
    if (tracks.length === 1 && startIndex === 0 && cur?.id === tracks[0]?.id) {
      if (!st.isPlaying) st.setPlaying(true);
      return;
    }
    const items = toQueueItems(tracks);
    const genres =
      contextGenres.length > 0
        ? contextGenres
        : [...new Set(items.flatMap((t) => t.genres.map((g) => g.slug)))];
    set({
      queue: items,
      index: Math.min(startIndex, items.length - 1),
      isPlaying: true,
      currentTime: 0,
      duration: 0,
      buffered: 0,
      contextGenres: genres,
      playedSessionIds: [...get().playedSessionIds, items[startIndex]?.id ?? ""].filter(Boolean).slice(-200),
    });
    if (record) recordPlay(items[startIndex]!);
  },

  loadQueueSilentRefresh: (items) => {
    const { queue, index } = get();
    if (items.length !== queue.length) return;
    set({
      queue: items,
      index: Math.min(index, items.length - 1),
      contextGenres: [
        ...new Set(items.flatMap((t) => t.genres.map((g) => g.slug))),
      ],
    });
  },

  loadQueue: (tracks, index = 0) => {
    if (tracks.length === 0) return;
    const items = toQueueItems(tracks);
    set({
      queue: items,
      index: Math.min(index, items.length - 1),
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      buffered: 0,
      contextGenres: [...new Set(items.flatMap((t) => t.genres.map((g) => g.slug)))],
    });
  },

  addToQueue: (track, next = false) => {
    const { queue, index } = get();
    const item = toQueueItems([track])[0]!;
    if (queue.length === 0) {
      set({ queue: [item], index: 0, isPlaying: true });
      recordPlay(item);
      return;
    }
    const insertAt = next ? index + 1 : queue.length;
    const nextQueue = [...queue];
    nextQueue.splice(insertAt, 0, item);
    set({ queue: nextQueue });
  },

  removeFromQueue: (queueKey) => {
    const { queue, index } = get();
    const pos = queue.findIndex((q) => q.queueKey === queueKey);
    if (pos === -1) return;
    const nextQueue = queue.filter((q) => q.queueKey !== queueKey);
    let nextIndex = index;
    if (pos < index) nextIndex = index - 1;
    else if (pos === index) nextIndex = Math.min(index, nextQueue.length - 1);
    set({ queue: nextQueue, index: Math.max(0, nextIndex) });
  },

  moveInQueue: (from, to) => {
    const { queue, index } = get();
    if (from === to || !queue[from] || !queue[to]) return;
    const currentKey = queue[index]?.queueKey;
    const nextQueue = [...queue];
    const [moved] = nextQueue.splice(from, 1);
    nextQueue.splice(to, 0, moved!);
    set({
      queue: nextQueue,
      index: nextQueue.findIndex((q) => q.queueKey === currentKey),
    });
  },

  clearEnded: () => set({ queue: [], index: 0, isPlaying: false }),

  next: () => {
    const { queue, index } = get();
    if (index + 1 < queue.length) {
      // Finished songs leave the queue: drop everything up to the next item.
      const item = queue[index + 1]!;
      set({
        queue: queue.slice(index + 1),
        index: 0,
        isPlaying: true,
        currentTime: 0,
        playedSessionIds: [...get().playedSessionIds, item.id].slice(-200),
      });
      recordPlay(item);
    } else {
      // Queue exhausted — the AudioEngine appends similar tracks
      // (auto-continue) before this becomes a dead end.
      set({ isPlaying: false });
    }
  },

  prev: () => {
    // No history is kept (finished songs leave the queue), so previous
    // always restarts the current track from the top.
    get().setTime(0);
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("minifm:seek", { detail: 0 }));
    }
  },

  playAt: (idx) => {
    const item = get().queue[idx];
    if (!item) return;
    // Same-track re-tap resumes instead of restarting (matches playTracks).
    if (idx === get().index && get().isPlaying) return;
    set({
      index: idx,
      isPlaying: true,
      currentTime: 0,
      playedSessionIds: [...get().playedSessionIds, item.id].slice(-200),
    });
    recordPlay(item);
  },

  setPlaying: (playing) => set({ isPlaying: playing }),
  setTime: (t, d, b) =>
    set((s) => ({
      currentTime: t,
      duration: d ?? s.duration,
      buffered: b ?? s.buffered,
    })),
  setVolume: (v) => set({ volume: v }),
  setMuted: (m) => set({ muted: m }),
  setQueueOpen: (open) => set({ queueOpen: open }),
  setLyricsOpen: (open) => set({ lyricsOpen: open }),
  setExpanded: (open) => set({ expanded: open }),
  setBuffering: (b) => set({ buffering: b }),
  setAudioError: (msg) => set({ audioError: msg }),
}));

function recordPlay(item: QueueItem) {
  if (typeof window === "undefined") return;
  try {
    const sessionId = getSessionId();
    fetch("/api/plays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId: item.id, sessionId }),
    }).catch(() => {});
  } catch {
    /* non-fatal */
  }
}
