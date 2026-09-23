import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { classifyMood, fitsMood, weightedShuffle } from "@/lib/mood";
import { languageMap, usedFacets } from "@/lib/catalog";
import { buildPlaylistTitle } from "@/lib/playlist-title";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { toTrack, type SongRowWithRelations } from "@/lib/db-types";

/**
 * POST /api/mood { prompt }
 * 1. Pull the LIVE genre list from the DB (Jev classifies against real slugs).
 * 2. Jev choice/score/boolean evaluation (keyword fallback if AI is down).
 * 3. Query matching songs, weight toward less-played + recent, take ~10-12.
 * 4. Templated title/blurb (no LLM).
 * 5. Returns tracks WITHOUT writing to the DB — persisting happens only via
 *    POST /api/playlists when the user taps Save/Share (spec §5.2.5).
 *
 * Rate-limited: 10 req / 10 min per IP+session (fans out to Jev + DB, no auth).
 */
export async function POST(req: Request) {
  let body: { prompt?: string; sessionId?: string };
  try {
    body = (await req.json()) as { prompt?: string; sessionId?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const prompt = (body.prompt ?? "").trim().slice(0, 500);
  if (prompt.length < 2) {
    return NextResponse.json({ error: "Tell us a little more about the mood." }, { status: 400 });
  }

  const key = `${clientIp(req)}:${body.sessionId ?? "anon"}`;
  const { limited, retryAfterSec } = isRateLimited(key);
  if (limited) {
    return NextResponse.json(
      { error: `Too many mood requests — try again in ${retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  const db = supabaseAdmin();
  const [{ data: genreRows }, used] = await Promise.all([
    db.from("genres").select("id, name, slug").order("name"),
    usedFacets(),
  ]);
  // Jev only ever sees genres that actually have songs — classifying into an
  // empty genre is a dead end for the user.
  const genres = (genreRows ?? []).filter((g) => used.genreIds.has(g.id));
  if (genres.length === 0) {
    return NextResponse.json(
      { error: "The catalog has no genres yet — try Explore instead." },
      { status: 503 },
    );
  }

  const verdict = await classifyMood(prompt, genres);
  if (!verdict) {
    return NextResponse.json({ error: "Could not understand that mood." }, { status: 422 });
  }

  const genreIds = [verdict.primaryGenreId, verdict.secondaryGenreId].filter(
    (g): g is string => !!g,
  );
  const { data: links } = await db
    .from("song_genres")
    .select("song_id, genre_id")
    .in("genre_id", genreIds);

  // Primary-genre matches first, secondary fills the rest.
  const primary = new Set(
    (links ?? []).filter((l) => l.genre_id === verdict.primaryGenreId).map((l) => l.song_id),
  );
  const secondary = new Set(
    (links ?? [])
      .filter((l) => verdict.secondaryGenreId && l.genre_id === verdict.secondaryGenreId)
      .map((l) => l.song_id),
  );
  let ids = [...primary];
  for (const id of secondary) if (!primary.has(id)) ids.push(id);

  // Instrumental preference: filter to instrumental tracks when Jev says so.
  let rows: SongRowWithRelations[] = [];
  if (ids.length > 0) {
    let q = db
      .from("songs")
      .select(
        `*, albums (id, title, slug, cover_art_url), song_artists (artists (id, name, slug)), song_genres (genres (id, name, slug))`,
      )
      .in("id", ids.slice(0, 200));
    if (verdict.instrumentalPref) q = q.eq("is_instrumental", true);
    const { data: songs } = await q;
    rows = ((songs ?? []) as unknown as SongRowWithRelations[]).filter((r) =>
      ids.includes(r.id),
    );
    // If the instrumental filter emptied the pool, fall back to the full pool.
    if (rows.length === 0 && verdict.instrumentalPref) {
      const { data: songs2 } = await db
        .from("songs")
        .select(
          `*, albums (id, title, slug, cover_art_url), song_artists (artists (id, name, slug)), song_genres (genres (id, name, slug))`,
        )
        .in("id", ids.slice(0, 200));
      rows = (songs2 ?? []) as unknown as SongRowWithRelations[];
    }
  }

  const langs = await languageMap();
  // Mood gate on titles: genre matching alone can't tell a party from a
  // eulogy. Self-harm titles never ship; grief/party titles are cut when
  // they clash with the detected energy.
  const fitting = rows
    .map((r) => toTrack(r, langs))
    .filter((t) => fitsMood(t.title, verdict.energy));
  const ordered = weightedShuffle(fitting).slice(0, 12);

  if (ordered.length === 0) {
    return NextResponse.json(
      {
        error:
          rows.length > 0
            ? "Nothing in the catalog fits that mood closely — try Explore instead of a weak mix."
            : "No tracks match that mood yet — try Explore while the catalog grows.",
        verdict,
      },
      { status: 404 },
    );
  }

  const bySlug = new Map(genres.map((g) => [g.slug, g.name]));
  const primaryName = bySlug.get(verdict.primaryGenreSlug) ?? verdict.primaryGenreSlug;
  const secondaryName = verdict.secondaryGenreSlug
    ? (bySlug.get(verdict.secondaryGenreSlug) ?? verdict.secondaryGenreSlug)
    : null;
  const totalSeconds = ordered.reduce((sum, t) => sum + (t.duration ?? 0), 0);
  const { title, blurb } = buildPlaylistTitle({
    moodPrompt: prompt,
    primaryGenre: primaryName,
    secondaryGenre: secondaryName,
    energy: verdict.energy,
    trackCount: ordered.length,
    totalSeconds,
  });

  return NextResponse.json({
    prompt,
    title,
    blurb,
    verdict: {
      primaryGenre: verdict.primaryGenreSlug,
      secondaryGenre: verdict.secondaryGenreSlug,
      energy: verdict.energy,
      instrumental: verdict.instrumentalPref,
      source: verdict.source,
    },
    matchedGenreIds: genreIds,
    matchedGenres: [
      { slug: verdict.primaryGenreSlug, name: primaryName },
      ...(verdict.secondaryGenreSlug && secondaryName
        ? [{ slug: verdict.secondaryGenreSlug, name: secondaryName }]
        : []),
    ],
    // Small shelves are honest, not padded: the UI labels them low-confidence.
    confidence: ordered.length >= 5 ? "high" : "low",
    tracks: ordered,
    // Returned (not persisted) so the client can POST to /api/playlists on Save.
    songIds: ordered.map((t) => t.id),
  });
}
