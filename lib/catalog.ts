import { supabaseAdmin } from "./supabase-server";
import type { SortKey } from "./sort";
import {
  TRACK_SELECT,
  toTrack,
  type SongRowWithRelations,
  type Track,
} from "./db-types";

/**
 * Shared catalog reads. The public site has no user accounts, so reads use
 * the service-role client against RLS `select using (true)` policies —
 * identical rows to what anon would see, without per-request auth overhead.
 * (Admin writes verify Supabase Auth + ENABLE_WRITE_OPERATIONS separately.)
 */

export type { SortKey };
export { SORT_LABELS } from "./sort";

export async function languageMap(): Promise<Map<string, string>> {
  const db = supabaseAdmin();
  const { data } = await db.from("languages").select("code, name");
  return new Map((data ?? []).map((l) => [l.code, l.name]));
}

export interface UsedFacets {
  genreIds: Set<string>;
  languageCodes: Set<string>;
  artistIds: Set<string>;
  decades: string[];
}

/**
 * Which facets actually have songs behind them — filters, homepage shelves
 * and the Jev genre list only offer these, so users never hit dead ends.
 */
export async function usedFacets(): Promise<UsedFacets> {
  const db = supabaseAdmin();
  const [{ data: sg }, { data: langs }, { data: sa }, { data: dates }] =
    await Promise.all([
      db.from("song_genres").select("genre_id").limit(5000),
      db.from("songs").select("language_code").limit(5000),
      db.from("song_artists").select("artist_id").limit(5000),
      db.from("songs").select("release_date").not("release_date", "is", null).limit(5000),
    ]);
  const decadeSet = new Set<string>();
  for (const r of dates ?? []) {
    const year = Number((r.release_date ?? "").slice(0, 4));
    if (Number.isFinite(year)) decadeSet.add(`${Math.floor(year / 10) * 10}s`);
  }
  return {
    genreIds: new Set((sg ?? []).map((r) => r.genre_id)),
    languageCodes: new Set(
      (langs ?? []).map((r) => r.language_code).filter((c): c is string => !!c),
    ),
    artistIds: new Set((sa ?? []).map((r) => r.artist_id)),
    decades: [...decadeSet].sort().reverse(),
  };
}

interface ExploreOpts {
  genreId?: string;
  languageCode?: string;
  artistId?: string;
  decade?: string; // e.g. "2010s"
  query?: string;
  sort?: SortKey;
  limit?: number;
}

export async function fetchTracks(opts: ExploreOpts = {}): Promise<Track[]> {
  const db = supabaseAdmin();
  const {
    genreId,
    languageCode,
    artistId,
    decade,
    query,
    sort = "recent",
    limit = 60,
  } = opts;

  // Genre/artist filtering goes through the join tables.
  let songIds: string[] | null = null;
  if (genreId) {
    const { data } = await db
      .from("song_genres")
      .select("song_id")
      .eq("genre_id", genreId);
    songIds = (data ?? []).map((r) => r.song_id);
    if (songIds.length === 0) return [];
  }
  if (artistId) {
    const { data } = await db
      .from("song_artists")
      .select("song_id")
      .eq("artist_id", artistId);
    const ids = new Set((data ?? []).map((r) => r.song_id));
    songIds = songIds ? songIds.filter((id) => ids.has(id)) : [...ids];
    if (songIds.length === 0) return [];
  }

  let q = db.from("songs").select(TRACK_SELECT);
  if (songIds) q = q.in("id", songIds);
  if (languageCode) q = q.eq("language_code", languageCode);
  if (decade) {
    const start = Number(decade.replace("s", ""));
    if (Number.isFinite(start)) {
      q = q.gte("release_date", `${start}-01-01`).lt("release_date", `${start + 10}-01-01`);
    }
  }
  if (query) {
    q = q.ilike("title", `%${query}%`);
  }

  switch (sort) {
    case "az":
      q = q.order("title", { ascending: true });
      break;
    case "released":
      q = q.order("release_date", { ascending: false, nullsFirst: false });
      break;
    case "played":
      q = q.order("play_count", { ascending: false });
      break;
    default:
      q = q.order("created_at", { ascending: false });
  }
  q = q.limit(limit);

  const { data, error } = await q;
  if (error) throw error;
  const langs = await languageMap();
  return ((data ?? []) as unknown as SongRowWithRelations[]).map((r) =>
    toTrack(r, langs),
  );
}

export async function fetchTrackBySlug(slug: string): Promise<Track | null> {
  return fetchTrackBySlugOrId(slug);
}

/**
 * Song URLs are canonical by ID (/song/[id]) — stable across title edits and
 * clean for non-Latin titles. Old slug links keep working via fallback.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchTrackBySlugOrId(slugOrId: string): Promise<Track | null> {
  const db = supabaseAdmin();
  const langs = await languageMap();
  const convert = (data: unknown) =>
    data ? toTrack(data as SongRowWithRelations, langs) : null;
  const { data: bySlug } = await db
    .from("songs")
    .select(TRACK_SELECT)
    .eq("slug", slugOrId)
    .maybeSingle();
  if (bySlug) return convert(bySlug);
  if (!UUID_RE.test(slugOrId)) return null;
  const { data: byId } = await db
    .from("songs")
    .select(TRACK_SELECT)
    .eq("id", slugOrId)
    .maybeSingle();
  return convert(byId);
}

export async function fetchTrackById(id: string): Promise<Track | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("songs")
    .select(TRACK_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const langs = await languageMap();
  return toTrack(data as unknown as SongRowWithRelations, langs);
}

export async function fetchTracksByIds(ids: string[]): Promise<Track[]> {
  if (ids.length === 0) return [];
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("songs")
    .select(TRACK_SELECT)
    .in("id", ids);
  if (error) throw error;
  const langs = await languageMap();
  const byId = new Map(
    ((data ?? []) as unknown as SongRowWithRelations[]).map((r) => [
      r.id,
      toTrack(r, langs),
    ]),
  );
  // Preserve the playlist's stored order.
  return ids.map((id) => byId.get(id)).filter((t): t is Track => !!t);
}

/** "More like this" from our own catalog: genre overlap, then language match. */
export async function fetchSimilar(
  track: Track,
  excludeIds: string[] = [],
  limit = 12,
): Promise<Track[]> {
  const genreIds = track.genres.map((g) => g.id);
  const db = supabaseAdmin();
  let candidateIds: string[] | null = null;
  if (genreIds.length > 0) {
    const { data } = await db
      .from("song_genres")
      .select("song_id")
      .in("genre_id", genreIds);
    // Rank by number of shared genres.
    const counts = new Map<string, number>();
    for (const r of data ?? []) {
      if (r.song_id === track.id || excludeIds.includes(r.song_id)) continue;
      counts.set(r.song_id, (counts.get(r.song_id) ?? 0) + 1);
    }
    candidateIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit * 2)
      .map(([id]) => id);
  }
  let pool = candidateIds?.length
    ? await fetchTracksByIds(candidateIds.slice(0, limit * 2))
    : [];
  if (pool.length < limit && track.languageCode) {
    const sameLang = (
      await fetchTracks({ languageCode: track.languageCode, limit: limit * 2 })
    ).filter(
      (t) =>
        t.id !== track.id &&
        !excludeIds.includes(t.id) &&
        !pool.some((p) => p.id === t.id),
    );
    pool = [...pool, ...sameLang];
  }
  // Same-language + shared-genre first, then most played.
  return pool
    .sort((a, b) => {
      const aScore =
        (track.languageCode && a.languageCode === track.languageCode ? 1 : 0) +
        a.genres.filter((g) => genreIds.includes(g.id)).length;
      const bScore =
        (track.languageCode && b.languageCode === track.languageCode ? 1 : 0) +
        b.genres.filter((g) => genreIds.includes(g.id)).length;
      return bScore - aScore || b.playCount - a.playCount;
    })
    .slice(0, limit);
}

