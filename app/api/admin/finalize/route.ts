import { NextResponse } from "next/server";
import { slugify } from "@/lib/utils";
import { discardUpload } from "@/lib/storage-cleanup";
import { requireAdmin } from "../_auth";

export interface FinalizePayload {
  title: string;
  artistNames: string[]; // supports features/collabs
  albumTitle?: string | null;
  albumType?: "album" | "single" | "ep";
  durationSeconds?: number | null;
  filePath: string; // already uploaded direct-to-storage
  fileHash: string; // SHA-256 hex, for duplicate detection
  coverArtUrl?: string | null;
  coverStoragePath?: string | null; // images-bucket path (for cleanup on replace)
  releaseDate?: string | null;
  languageCode?: string | null;
  isInstrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
  lyricsSource?: string | null;
  musicbrainzId?: string | null;
  isrc?: string | null;
  artistImageUrl?: string | null;
  artistMusicbrainzIds?: string[];
  albumMusicbrainzId?: string | null;
  genreNames?: string[];
}

async function uniqueSlug(
  db: ReturnType<typeof import("@/lib/supabase-server").supabaseAdmin>,
  table: "songs" | "artists" | "albums",
  base: string,
): Promise<string> {
  let slug = slugify(base);
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i}`;
    const { data } = await db.from(table).select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

/**
 * The `release_date` columns are true dates — a year-only string ("2019")
 * would fail the insert. Accept full YYYY-MM-DD, drop anything else.
 */
function cleanDate(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/**
 * Does the uploaded object still exist? Retries reuse `storagePath`, but the
 * bytes can be gone (deleted externally, or discarded by an earlier failed
 * attempt) — saving a row that points at nothing bricks playback with an
 * undebuggable "sign failed". Fail fast with FILE_GONE so the client can
 * re-upload from the held File and retry.
 */
async function uploadExists(
  db: ReturnType<typeof import("@/lib/supabase-server").supabaseAdmin>,
  filePath: string,
): Promise<boolean> {
  if (!filePath.startsWith("tracks/") || filePath.includes("..")) return false;
  const name = filePath.slice("tracks/".length);
  if (!name) return false;
  const { data } = await db.storage.from("audio").list("tracks", { search: name });
  return data?.some((f) => f.name === name) ?? false;
}

/**
 * Finalize an upload: audio bytes are ALREADY in Supabase Storage (direct
 * browser PUT to a signed upload URL). This route only ever handles small
 * JSON metadata — dedup check → upsert artists/album/genres → insert song.
 */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const db = gate.db;

  let body: FinalizePayload;
  try {
    body = (await req.json()) as FinalizePayload;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.title?.trim() || !body.artistNames?.length || !body.filePath || !body.fileHash) {
    return NextResponse.json(
      { error: "title, artists, filePath and fileHash are required" },
      { status: 400 },
    );
  }

  // The bytes must exist — a retry can reference a path whose object was
  // discarded by an earlier failed attempt or deleted externally.
  if (!(await uploadExists(db, body.filePath))) {
    return NextResponse.json(
      { error: "Stored audio bytes are missing — re-upload, then retry.", code: "FILE_GONE" },
      { status: 400 },
    );
  }

  // Duplicate detection: block on matching SHA-256.
  const { data: dup } = await db
    .from("songs")
    .select("id, title, slug")
    .eq("file_hash", body.fileHash)
    .maybeSingle();
  if (dup) {
    // Same bytes share one path — delete ONLY when no row references it
    // (legacy timestamped twin). Never orphan the winning row's file.
    const { data: ref } = await db
      .from("songs")
      .select("id")
      .eq("file_path", body.filePath)
      .maybeSingle();
    let fileDiscarded = false;
    if (!ref) {
      await discardUpload(db, body.filePath);
      fileDiscarded = true;
    }
    return NextResponse.json(
      {
        error: "Duplicate file — this audio is already in the catalog.",
        song: dup,
        fileDiscarded,
      },
      { status: 409 },
    );
  }

  // Artists (match by name, case-insensitive).
  const artistIds: string[] = [];
  for (let i = 0; i < body.artistNames.length; i++) {
    const name = body.artistNames[i]!.trim();
    if (!name) continue;
    const { data: existing } = await db
      .from("artists")
      .select("id")
      .ilike("name", name)
      .maybeSingle();
    if (existing) {
      artistIds.push(existing.id);
      continue;
    }
    const { data: created, error } = await db
      .from("artists")
      .insert({
        name,
        slug: await uniqueSlug(db, "artists", name),
        image_url: i === 0 ? (body.artistImageUrl ?? null) : null,
        musicbrainz_id: body.artistMusicbrainzIds?.[i] ?? null,
      })
      .select("id")
      .single();
    if (error || !created) {
      // No discard here: the client may retry with the same storagePath, and
      // deleting under it bricks the retry (row → missing object). Stale
      // objects are owned by the storage janitor.
      return NextResponse.json(
        { error: `artist save failed (${name}): ${error?.message ?? "unknown"}` },
        { status: 500 },
      );
    }
    artistIds.push(created.id);
  }

  // Album (optional).
  let albumId: string | null = null;
  let albumCover = body.coverArtUrl ?? null;
  if (body.albumTitle?.trim()) {
    const albumTitle = body.albumTitle.trim();
    const { data: existing } = await db
      .from("albums")
      .select("id, cover_art_url")
      .ilike("title", albumTitle)
      .maybeSingle();
    if (existing) {
      albumId = existing.id;
      albumCover = albumCover ?? existing.cover_art_url;
    } else {
      const { data: created, error } = await db
        .from("albums")
        .insert({
          title: albumTitle,
          slug: await uniqueSlug(db, "albums", albumTitle),
          cover_art_url: albumCover,
          release_date: cleanDate(body.releaseDate),
          album_type: body.albumType ?? "album",
          musicbrainz_id: body.albumMusicbrainzId ?? null,
        })
        .select("id")
        .single();
      if (error || !created) {
        return NextResponse.json(
          { error: `album save failed: ${error?.message ?? "unknown"}` },
          { status: 500 },
        );
      }
      albumId = created.id;
    }
    // Link album ↔ artists.
    await db.from("album_artists").upsert(
      artistIds.map((artist_id) => ({ album_id: albumId!, artist_id })),
      { onConflict: "album_id,artist_id" },
    );
  }

  // Song (cover falls back to album art at read time; store explicit when set).
  const { data: song, error: songError } = await db
    .from("songs")
    .insert({
      title: body.title.trim(),
      slug: await uniqueSlug(db, "songs", body.title),
      album_id: albumId,
      duration_seconds:
        typeof body.durationSeconds === "number" &&
        Number.isFinite(body.durationSeconds) &&
        body.durationSeconds > 0
          ? Math.round(body.durationSeconds)
          : null,
      file_path: body.filePath,
      file_hash: body.fileHash,
      cover_art_url: body.coverArtUrl ?? null,
      release_date: cleanDate(body.releaseDate),
      language_code: body.languageCode ?? null,
      is_instrumental: body.isInstrumental ?? false,
      plain_lyrics: body.plainLyrics ?? null,
      synced_lyrics: body.syncedLyrics ?? null,
      lyrics_source: body.lyricsSource ?? null,
      musicbrainz_id: body.musicbrainzId ?? null,
      isrc: body.isrc ?? null,
    })
    .select("id, slug")
    .single();
  if (songError || !song) {
    return NextResponse.json(
      { error: `song save failed: ${songError?.message}` },
      { status: 500 },
    );
  }

  await db.from("song_artists").upsert(
    artistIds.map((artist_id) => ({ song_id: song!.id, artist_id })),
    { onConflict: "song_id,artist_id" },
  );

  // Genres (match by name; create missing).
  if (body.genreNames?.length) {
    const genreIds: string[] = [];
    for (const raw of body.genreNames) {
      const name = raw.trim();
      if (!name) continue;
      const { data: existing } = await db
        .from("genres")
        .select("id")
        .ilike("name", name)
        .maybeSingle();
      if (existing) {
        genreIds.push(existing.id);
        continue;
      }
      const { data: created } = await db
        .from("genres")
        .insert({ name, slug: slugify(name) })
        .select("id")
        .single();
      if (created) genreIds.push(created.id);
    }
    if (genreIds.length) {
      await db.from("song_genres").upsert(
        genreIds.map((genre_id) => ({ song_id: song!.id, genre_id })),
        { onConflict: "song_id,genre_id" },
      );
    }
  }

  return NextResponse.json({ ok: true, song });
}
