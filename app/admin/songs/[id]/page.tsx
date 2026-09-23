import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import SongEditForm from "@/components/SongEditForm";

export const metadata: Metadata = { title: "Edit song · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminSongEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();
  const [{ data: song }, { data: genres }, { data: languages }, { data: artists }, { data: albums }] =
    await Promise.all([
      db.from("songs").select("*").eq("id", id).maybeSingle(),
      db.from("genres").select("id, name").order("name"),
      db.from("languages").select("code, name").order("name"),
      db.from("artists").select("id, name").order("name").limit(300),
      db.from("albums").select("id, title").order("title").limit(300),
    ]);
  if (!song) notFound();
  const [{ data: sg }, { data: sa }] = await Promise.all([
    db.from("song_genres").select("genre_id").eq("song_id", id),
    db.from("song_artists").select("artist_id").eq("song_id", id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-black">Edit: {song.title}</h1>
      <SongEditForm
        songId={song.id}
        initial={{
          title: song.title,
          releaseDate: song.release_date ?? "",
          languageCode: song.language_code ?? "",
          isInstrumental: song.is_instrumental,
          coverArtUrl: song.cover_art_url ?? "",
          plainLyrics: song.plain_lyrics ?? "",
          syncedLyrics: song.synced_lyrics ?? "",
          genreIds: (sg ?? []).map((r) => r.genre_id),
          artistIds: (sa ?? []).map((r) => r.artist_id),
          albumId: song.album_id ?? "",
          durationSeconds: song.duration_seconds ?? null,
        }}
        allGenres={genres ?? []}
        allLanguages={languages ?? []}
        allArtists={artists ?? []}
        allAlbums={albums ?? []}
      />
    </div>
  );
}
