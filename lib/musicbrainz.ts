/**
 * MusicBrainz API client (no key required) + Cover Art Archive for covers.
 *
 * Docs: https://musicbrainz.org/doc/MusicBrainz_API
 * Rules we follow: descriptive User-Agent on every request, max ~1 req/sec
 * (enforced below via a shared throttle), and no spidering — this only runs
 * on explicit admin enrichment calls, a handful of requests each.
 *
 * What each piece provides for the upload pipeline:
 * - recording search  → MBIDs, title, artist credits, first-release-date
 * - recording lookup  → duration (length ms), ISRCs
 * - artist lookup     → genres (community-voted; filtered, see below)
 * - release lookup    → authoritative date + release-group primary-type
 * - Cover Art Archive → cover art (front-500, verified before use)
 *
 * What MusicBrainz does NOT have: artist photos (artists[].imageUrl is always
 * null — paste manually in the review form) and reliable language data.
 */

const MB_BASE = "https://musicbrainz.org/ws/2";
const CAA_BASE = "https://coverartarchive.org";
const UA = "MiniFM/2.0 (https://github.com/damashiai/mini-fm)";
const MIN_GAP_MS = 1100;

let lastMbCall = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Throttled MusicBrainz GET with one retry on rate-limit 503s. */
async function mbJson<T>(path: string, retries = 1): Promise<T> {
  const wait = MIN_GAP_MS - (Date.now() - lastMbCall);
  if (wait > 0) await sleep(wait);
  lastMbCall = Date.now();
  const res = await fetch(`${MB_BASE}${path}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 503 && retries > 0) {
    await sleep(1500);
    return mbJson<T>(path, retries - 1);
  }
  if (!res.ok) throw new Error(`MusicBrainz API failed: ${res.status}`);
  return (await res.json()) as T;
}

export interface Enrichment {
  track: {
    musicbrainzId: string;
    title: string;
    durationSeconds: number | null;
    isrc: string | null;
  } | null;
  album: {
    musicbrainzId: string;
    title: string;
    coverArtUrl: string | null;
    releaseDate: string | null;
    albumType: "album" | "single" | "ep";
  } | null;
  artists: {
    musicbrainzId: string;
    name: string;
    imageUrl: string | null; // MusicBrainz hosts no artist photos — always null
    genres: string[];
  }[];
  genres: string[];
}

interface MbRecordingHit {
  id: string;
  score: number;
  title: string;
  disambiguation?: string;
  video?: boolean;
  "first-release-date"?: string;
  "artist-credit"?: { name: string; artist?: { id: string; name: string } }[];
  releases?: { id: string; title: string; date?: string; status?: string }[];
}

interface MbRecordingLookup {
  id: string;
  title: string;
  length?: number | null;
  isrcs?: string[];
}

interface MbArtist {
  id: string;
  name: string;
  genres?: { name: string; count: number }[];
  tags?: { name: string; count: number }[];
}

interface MbRelease {
  id: string;
  title: string;
  date?: string;
  status?: string;
  "release-group"?: { id: string; title: string; "primary-type"?: string };
}

/** Strip Lucene-breaking quotes; empty string means "don't use this clause". */
function clean(value: string | undefined): string {
  return (value ?? "").replace(/["\\]/g, "").trim();
}

/**
 * Community genres are noisy long-tail tags ("yakousei"). Keep only genres
 * with real votes: threshold scales with the top vote count, cap at 3.
 */
function pickGenres(all: { name: string; count: number }[] | undefined): string[] {
  if (!all?.length) return [];
  const sorted = [...all].sort((a, b) => b.count - a.count);
  const threshold = Math.max(2, Math.ceil((sorted[0]!.count ?? 0) / 3));
  return sorted
    .filter((g) => g.count >= threshold)
    .slice(0, 3)
    .map((g) => g.name);
}

function normalizeAlbumType(primary?: string): "album" | "single" | "ep" {
  const v = (primary ?? "").toLowerCase();
  if (v === "single") return "single";
  if (v === "ep") return "ep";
  return "album";
}

/** Prefer official, earliest releases — the original single over compilations. */
function pickHit(hits: MbRecordingHit[]): MbRecordingHit | undefined {
  const ranked = [...hits].sort((a, b) => {
    const aOff =
      a.releases?.some((r) => r.status === "Official") ?? false ? 0 : 1;
    const bOff =
      b.releases?.some((r) => r.status === "Official") ?? false ? 0 : 1;
    if (aOff !== bOff) return aOff - bOff;
    const aDate = a["first-release-date"] ?? "9999";
    const bDate = b["first-release-date"] ?? "9999";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return (b.score ?? 0) - (a.score ?? 0);
  });
  return ranked[0];
}

function pickRelease(
  hit: MbRecordingHit,
): { id: string; title: string; date?: string } | undefined {
  const rels = hit.releases ?? [];
  if (rels.length === 0) return undefined;
  const official = rels.filter((r) => r.status === "Official");
  const pool = official.length > 0 ? official : rels;
  const sorted = [...pool].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const first = sorted[0]!;
  return { id: first.id, title: first.title, date: first.date };
}

async function coverArtUrl(releaseMbid: string): Promise<string | null> {
  const url = `${CAA_BASE}/release/${releaseMbid}/front-500`;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

export async function enrichFromMusicBrainz(
  title: string,
  artist: string,
  album?: string,
): Promise<Enrichment> {
  const t = clean(title);
  const a = clean(artist);
  const al = clean(album);
  if (!t || !a) return { track: null, album: null, artists: [], genres: [] };

  // 1. Recording search — fielded first, plain dismax fallback.
  const fielded =
    `recording:"${t}" AND artist:"${a}"` + (al ? ` AND release:"${al}"` : "");
  let hits: MbRecordingHit[] = [];
  try {
    const found = await mbJson<{ recordings?: MbRecordingHit[] }>(
      `/recording/?query=${encodeURIComponent(fielded)}&fmt=json&limit=10`,
    );
    hits = found.recordings ?? [];
  } catch {
    hits = [];
  }
  if (hits.length === 0) {
    const plain = await mbJson<{ recordings?: MbRecordingHit[] }>(
      `/recording/?query=${encodeURIComponent(`${t} ${a}`)}&fmt=json&limit=10&dismax=true`,
    );
    hits = plain.recordings ?? [];
  }
  const hit = pickHit(hits);
  if (!hit) return { track: null, album: null, artists: [], genres: [] };

  // 2. Recording lookup → duration + ISRCs.
  let length: number | null = null;
  let isrc: string | null = null;
  try {
    const rec = await mbJson<MbRecordingLookup>(
      `/recording/${hit.id}?fmt=json&inc=isrcs`,
    );
    length = rec.length ?? null;
    isrc = rec.isrcs?.[0] ?? null;
  } catch {
    /* duration falls back to ID3, ISRC stays null */
  }

  // 3. Artist lookup(s) → community genres.
  const credits = (hit["artist-credit"] ?? []).slice(0, 3);
  const artists = await Promise.all(
    credits.map(async (c) => {
      const mbid = c.artist?.id;
      const name = c.artist?.name ?? c.name;
      let genres: string[] = [];
      if (mbid) {
        try {
          const detail = await mbJson<MbArtist>(
            `/artist/${mbid}?fmt=json&inc=genres+tags`,
          );
          genres = pickGenres(detail.genres ?? detail.tags);
        } catch {
          genres = [];
        }
      }
      return { musicbrainzId: mbid ?? "", name, imageUrl: null, genres };
    }),
  );

  // 4. Release pick → authoritative date + album type via release-group.
  const rel = pickRelease(hit);
  let albumPayload: Enrichment["album"] = null;
  if (rel) {
    let releaseDate = rel.date ?? hit["first-release-date"] ?? null;
    let albumType: "album" | "single" | "ep" = "album";
    try {
      const release = await mbJson<MbRelease>(
        `/release/${rel.id}?fmt=json&inc=release-groups`,
      );
      releaseDate = release.date ?? releaseDate;
      albumType = normalizeAlbumType(release["release-group"]?.["primary-type"]);
    } catch {
      /* keep hit-derived date + default type */
    }
    albumPayload = {
      musicbrainzId: rel.id,
      title: rel.title,
      coverArtUrl: await coverArtUrl(rel.id),
      releaseDate,
      albumType,
    };
  }

  return {
    track: {
      musicbrainzId: hit.id,
      title: hit.title,
      // null (not 0) when unknown — 0 would poison the ?? merge downstream
      // and 0 seconds in the DB breaks lyrics-version matching.
      durationSeconds: length ? Math.round(length / 1000) : null,
      isrc,
    },
    album: albumPayload,
    artists,
    genres: [...new Set(artists.flatMap((x) => x.genres))],
  };
}
