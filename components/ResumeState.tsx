"use client";

import { useEffect, useRef } from "react";
import type { Track } from "@/lib/db-types";
import { usePlayer } from "./player-store";

const KEY = "minifm:last-state-v2";
const LEGACY_KEY = "minifm:last-state-v1";
const MAX_TRACKS = 40;

interface SavedState {
  tracks: Track[];
  index: number;
  time: number;
  savedAt: number;
}

/**
 * Resume: the player bar instantly shows the last-played song — title, art,
 * duration and position — on revisit, with zero network wait. Full track
 * snapshots (including duration) are cached in localStorage; a background
 * revalidation then reconciles against the DB (deleted songs drop out) only
 * if the user hasn't touched playback meanwhile.
 *
 * Restores paused (browsers block autoplay) and never records a play.
 */
export default function ResumeState() {
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    const apply = (tracks: Track[], index: number, time: number) => {
      if (tracks.length === 0) return false;
      const st = usePlayer.getState();
      // loadQueue: silent (no tab-sync claim, no play-count record).
      st.loadQueue(tracks.slice(0, MAX_TRACKS), Math.min(index, tracks.length - 1));
      if (time > 2) {
        document.dispatchEvent(new CustomEvent("minifm:seek-after-load", { detail: time }));
        st.setTime(time);
      }
      return true;
    };

    const revalidate = (tracks: Track[]) => {
      const ids = tracks.map((t) => t.id);
      if (ids.length === 0) return;
      fetch(`/api/tracks?ids=${encodeURIComponent(ids.join(","))}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const fresh = (j?.tracks ?? []) as Track[];
          const st = usePlayer.getState();
          // Hands off if the user already took over playback.
          if (st.isPlaying) return;
          const liveIds = st.queue.map((q) => q.id).join(",");
          if (liveIds !== ids.join(",")) return;
          const freshIds = new Set(fresh.map((t) => t.id));
          if (freshIds.size === ids.length) {
            // Same songs — refresh metadata (edits, new art) in place.
            const byId = new Map(fresh.map((t) => [t.id, t]));
            const merged = st.queue.map((q) => {
              const f = byId.get(q.id);
              return f ? { ...f, queueKey: q.queueKey } : q;
            });
            st.loadQueueSilentRefresh(merged);
          } else if (fresh.length > 0) {
            // Something was deleted — drop it, keep position by id.
            const curId = st.queue[st.index]?.id;
            const idx = Math.max(
              0,
              fresh.findIndex((t) => t.id === curId),
            );
            st.loadQueue(fresh, idx);
            const t = st.currentTime;
            if (t > 2) {
              document.dispatchEvent(
                new CustomEvent("minifm:seek-after-load", { detail: t }),
              );
            }
          } else {
            // Whole queue gone from the catalog — clear the ghost bar.
            st.clearEnded();
            try {
              window.localStorage.removeItem(KEY);
            } catch {
              /* noop */
            }
          }
        })
        .catch(() => {});
    };

    // Fast path: full snapshot, zero network.
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SavedState;
        if (Array.isArray(saved.tracks) && saved.tracks.length > 0) {
          if (apply(saved.tracks, saved.index ?? 0, saved.time ?? 0)) {
            revalidate(saved.tracks);
            return;
          }
        }
      }
    } catch {
      /* corrupted cache — fall through to legacy */
    }

    // Legacy path (v1 ids-only snapshot): fetch, then apply.
    try {
      const raw = window.localStorage.getItem(LEGACY_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { ids?: string[]; index?: number; time?: number };
      if (!saved?.ids?.length) return;
      fetch(`/api/tracks?ids=${encodeURIComponent(saved.ids.join(","))}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const tracks = (j?.tracks ?? []) as Track[];
          if (tracks.length > 0) apply(tracks, saved.index ?? 0, saved.time ?? 0);
        })
        .catch(() => {});
    } catch {
      /* noop */
    }
  }, []);

  // Persist full snapshots (throttled + on unload).
  useEffect(() => {
    let lastWrite = 0;
    const save = () => {
      const now = Date.now();
      if (now - lastWrite < 5000) return;
      lastWrite = now;
      const { queue, index, currentTime } = usePlayer.getState();
      if (queue.length === 0) return;
      try {
        const payload: SavedState = {
          tracks: queue.slice(0, MAX_TRACKS).map(({ queueKey: _q, ...t }) => t as Track),
          index,
          time: currentTime,
          savedAt: now,
        };
        window.localStorage.setItem(KEY, JSON.stringify(payload));
      } catch {
        /* storage full/blocked — non-fatal */
      }
    };
    const unsub = usePlayer.subscribe(() => save());
    window.addEventListener("beforeunload", save);
    return () => {
      unsub();
      window.removeEventListener("beforeunload", save);
    };
  }, []);

  return null;
}
