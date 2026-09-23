export type AlbumType = "album" | "single" | "ep";

export interface Artist {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  image_url: string | null;
  musicbrainz_id: string | null;
  created_at: string;
}

export interface Album {
  id: string;
  title: string;
  slug: string;
  cover_art_url: string | null;
  release_date: string | null;
  album_type: AlbumType;
  musicbrainz_id: string | null;
  created_at: string;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
}

export interface Language {
  id: string;
  code: string;
  name: string;
}

export interface Song {
  id: string;
  title: string;
  slug: string;
  album_id: string | null;
  duration_seconds: number | null;
  file_path: string;
  file_hash: string | null;
  cover_art_url: string | null;
  release_date: string | null;
  language_code: string | null;
  is_instrumental: boolean;
  plain_lyrics: string | null;
  synced_lyrics: string | null;
  lyrics_source: string | null;
  musicbrainz_id: string | null;
  isrc: string | null;
  play_count: number;
  created_at: string;
}

export interface Play {
  id: number;
  song_id: string;
  played_at: string;
  session_id: string | null;
}

export interface PlaylistRow {
  id: string;
  mood_prompt: string;
  matched_genre_ids: string[];
  song_ids: string[];
  share_slug: string;
  created_at: string;
  expires_at: string;
}

/** Song row joined with its relations — the shape the UI consumes. */
export interface Track {
  id: string;
  title: string;
  slug: string;
  duration: number | null;
  coverArt: string | null;
  releaseDate: string | null;
  languageCode: string | null;
  languageName: string | null;
  isInstrumental: boolean;
  hasSyncedLyrics: boolean;
  hasPlainLyrics: boolean;
  playCount: number;
  createdAt: string;
  artists: { id: string; name: string; slug: string }[];
  album: { id: string; title: string; slug: string; coverArt: string | null } | null;
  genres: { id: string; name: string; slug: string }[];
  artistNames: string;
}

export interface SongRowWithRelations extends Song {
  albums: Pick<Album, "id" | "title" | "slug" | "cover_art_url"> | null;
  song_artists: { artists: Pick<Artist, "id" | "name" | "slug"> | null }[];
  song_genres: { genres: Pick<Genre, "id" | "name" | "slug"> | null }[];
  languages?: Pick<Language, "code" | "name"> | null;
}

export function toTrack(
  row: SongRowWithRelations,
  languageMap?: Map<string, string>,
): Track {
  const artists = (row.song_artists ?? [])
    .map((sa) => sa.artists)
    .filter((a): a is Pick<Artist, "id" | "name" | "slug"> => a != null);
  const genres = (row.song_genres ?? [])
    .map((sg) => sg.genres)
    .filter((g): g is Pick<Genre, "id" | "name" | "slug"> => g != null);
  const cover =
    row.cover_art_url ?? row.albums?.cover_art_url ?? null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    duration: row.duration_seconds,
    coverArt: cover,
    releaseDate: row.release_date,
    languageCode: row.language_code,
    languageName:
      row.languages?.name ??
      (row.language_code ? languageMap?.get(row.language_code) ?? null : null),
    isInstrumental: row.is_instrumental,
    hasSyncedLyrics: !!row.synced_lyrics,
    hasPlainLyrics: !!row.plain_lyrics,
    playCount: row.play_count ?? 0,
    createdAt: row.created_at,
    artists: artists.map((a) => ({ id: a.id, name: a.name, slug: a.slug })),
    album: row.albums
      ? {
          id: row.albums.id,
          title: row.albums.title,
          slug: row.albums.slug,
          coverArt: row.albums.cover_art_url,
        }
      : null,
    genres: genres.map((g) => ({ id: g.id, name: g.name, slug: g.slug })),
    artistNames: artists.map((a) => a.name).join(", ") || "Unknown artist",
  };
}

export const TRACK_SELECT = `
  *,
  albums (id, title, slug, cover_art_url),
  song_artists (artists (id, name, slug)),
  song_genres (genres (id, name, slug))
`;
