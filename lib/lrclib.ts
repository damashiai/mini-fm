/**
 * lrclib.net public API client (no key required).
 * Confirmed shapes against https://lrclib.net/docs:
 *   GET /api/get?artist_name=&track_name=&album_name=&duration=  (exact match)
 *   GET /api/search?track_name=&artist_name=                     (fuzzy)
 * Response: { id, trackName, artistName, albumName, duration, instrumental,
 *             plainLyrics, syncedLyrics } — 404 when nothing matches.
 */

const BASE = "https://lrclib.net/api";

export interface LrclibResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export interface ResolvedLyrics {
  status: "synced" | "plain" | "instrumental" | "not-found";
  plainLyrics: string | null;
  syncedLyrics: string | null;
  source: string | null;
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: {
      // lrclib asks clients to send an identifying User-Agent.
      "User-Agent": "MiniFM/2.0 (https://github.com/damashiai/mini-fm)",
    },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lrclib ${res.status}`);
  return (await res.json()) as T;
}

/** Exact match first, then fuzzy search fallback. Never throws — returns not-found. */
export async function resolveLyrics(opts: {
  track: string;
  artist: string;
  album?: string | null;
  durationSeconds?: number | null;
}): Promise<ResolvedLyrics> {
  const notFound: ResolvedLyrics = {
    status: "not-found",
    plainLyrics: null,
    syncedLyrics: null,
    source: null,
  };
  try {
    const params = new URLSearchParams({
      artist_name: opts.artist,
      track_name: opts.track,
    });
    if (opts.album) params.set("album_name", opts.album);
    if (opts.durationSeconds) params.set("duration", String(Math.round(opts.durationSeconds)));
    let hit = await getJson<LrclibResult>(`${BASE}/get?${params}`);
    if (!hit) {
      const sp = new URLSearchParams({
        track_name: opts.track,
        artist_name: opts.artist,
      });
      const list = await getJson<LrclibResult[]>(`${BASE}/search?${sp}`);
      hit = list?.[0] ?? null;
    }
    if (!hit) return notFound;
    if (hit.instrumental) {
      return { status: "instrumental", plainLyrics: null, syncedLyrics: null, source: "lrclib" };
    }
    if (hit.syncedLyrics) {
      return {
        status: "synced",
        plainLyrics: hit.plainLyrics,
        syncedLyrics: hit.syncedLyrics,
        source: "lrclib",
      };
    }
    if (hit.plainLyrics) {
      return {
        status: "plain",
        plainLyrics: hit.plainLyrics,
        syncedLyrics: null,
        source: "lrclib",
      };
    }
    return notFound;
  } catch {
    return notFound;
  }
}

export interface LrcLine {
  time: number;
  text: string;
}

/** Parse [mm:ss.xx] LRC timestamps client-side against audio.currentTime. */
export function parseLrc(lrc: string): LrcLine[] {
  const lines: LrcLine[] = [];
  for (const raw of lrc.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const matches = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = line.replace(/\[.*?\]/g, "").trim();
    if (matches.length === 0 || !text) continue;
    for (const m of matches) {
      const min = Number(m[1]);
      const sec = Number(m[2]);
      let frac = 0;
      if (m[3]) {
        const digits = m[3];
        frac = Number(digits) / (digits.length === 3 ? 1000 : 100);
      }
      lines.push({ time: min * 60 + sec + frac, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

/** Index of the active line for a given playback time (-1 = none yet). */
export function activeLineIndex(lines: LrcLine[], time: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.time <= time + 0.05) idx = i;
    else break;
  }
  return idx;
}

/** Strip LRC timestamps/headers → plain text (for language detection). */
export function stripLrc(lrc: string): string {
  return lrc
    .split("\n")
    .map((line) => line.replace(/\[.*?\]/g, "").trim())
    .filter((line) => line && !/^(ti|ar|al|au|by|offset|re|ve):/i.test(line))
    .join("\n");
}
