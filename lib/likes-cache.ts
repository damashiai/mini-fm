"use client";

import { getSessionId } from "./session";

/**
 * Shared anonymous-likes cache: every song card mounts a LikeButton, and
 * without this each one fires GET /api/likes. One inflight request per
 * session per minute, stale-while-revalidate everywhere else.
 */
interface CacheEntry {
  session: string;
  ids: Set<string>;
  at: number;
}

let cache: CacheEntry | null = null;
let inflight: Promise<Set<string>> | null = null;
const TTL_MS = 60_000;

/** Last known value, synchronously (null = never fetched). */
export function likedSnapshot(): Set<string> | null {
  try {
    if (cache && cache.session === getSessionId()) return cache.ids;
  } catch {
    /* storage blocked */
  }
  return null;
}

export function fetchLikedIds(): Promise<Set<string>> {
  let session = "";
  try {
    session = getSessionId();
  } catch {
    return Promise.resolve(new Set<string>());
  }
  const now = Date.now();
  if (cache && cache.session === session && now - cache.at < TTL_MS) {
    return Promise.resolve(cache.ids);
  }
  if (!inflight) {
    inflight = fetch(`/api/likes?sessionId=${encodeURIComponent(session)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => new Set<string>(Array.isArray(j?.songIds) ? j.songIds : []))
      .catch(() => new Set<string>())
      .then((ids) => {
        cache = { session, ids, at: Date.now() };
        inflight = null;
        return ids;
      });
  }
  return inflight;
}

/** Optimistic local update after a toggle (server call happens separately). */
export function markLikedLocal(songId: string, liked: boolean): void {
  if (!cache) return;
  const next = new Set(cache.ids);
  if (liked) next.add(songId);
  else next.delete(songId);
  cache = { ...cache, ids: next, at: Date.now() };
}
