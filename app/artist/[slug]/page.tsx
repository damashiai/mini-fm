import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { fetchTracks } from "@/lib/catalog";
import { SongRow } from "@/components/SongCard";
import CoverImage from "@/components/CoverImage";
import { Disc3, Mic } from "lucide-react";
import { PlayAllButton } from "@/components/PlayControls";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const db = supabaseAdmin();
  const { data } = await db.from("artists").select("name").eq("slug", (await params).slug).maybeSingle();
  return { title: data ? `${data.name}` : "Artist" };
}

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const db = supabaseAdmin();
  const { data: artist } = await db
    .from("artists")
    .select("*")
    .eq("slug", (await params).slug)
    .maybeSingle();
  if (!artist) notFound();

  const tracks = await fetchTracks({ artistId: artist.id, sort: "released", limit: 100 });

  // Discography grouped by album type.
  const { data: albumLinks } = await db
    .from("album_artists")
    .select("albums (id, title, slug, cover_art_url, release_date, album_type)")
    .eq("artist_id", artist.id);
  const albums = (albumLinks ?? [])
    .map((l) => l.albums as unknown as {
      id: string; title: string; slug: string; cover_art_url: string | null;
      release_date: string | null; album_type: string;
    })
    .filter(Boolean)
    .sort((a, b) => (b.release_date ?? "").localeCompare(a.release_date ?? ""));
  const groups: Record<string, typeof albums> = { album: [], single: [], ep: [] };
  for (const a of albums) groups[a.album_type]?.push(a);

  // Loose tracks (no album) for the "Singles & loose tracks" shelf.
  const loose = tracks.filter((t) => !t.album);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        {artist.image_url ? (
          <CoverImage
            src={artist.image_url}
            alt={artist.name}
            eager
            className="h-44 w-44 rounded-full shadow-2xl"
          />
        ) : (
          <div className="grid h-44 w-44 place-items-center rounded-full bg-card text-muted">
            <Mic size={56} />
          </div>
        )}
        <div>
          <h1 className="text-3xl font-black">{artist.name}</h1>
          {artist.bio && <p className="mt-2 max-w-2xl text-sm text-muted">{artist.bio}</p>}
          <p className="mt-2 text-xs text-muted">{tracks.length} tracks · {albums.length} releases</p>
          <div className="mt-4">
            <PlayAllButton tracks={tracks} label="Play artist" />
          </div>
        </div>
      </div>

      {tracks.length > 0 && (
        <section>
          <h2 className="mb-2 text-xl font-extrabold">Top tracks</h2>
          <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal px-2">
            {tracks.slice(0, 10).map((t, i) => (
              <SongRow key={t.id} track={t} tracks={tracks} index={i} />
            ))}
          </div>
        </section>
      )}

      {(["album", "ep", "single"] as const).map((type) =>
        groups[type]!.length > 0 ? (
          <section key={type}>
            <h2 className="mb-3 text-xl font-extrabold capitalize">
              {type === "album" ? "Albums" : type === "ep" ? "EPs" : "Singles"}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {groups[type]!.map((a) => (
                <Link key={a.id} href={`/album/${a.slug}`} className="group overflow-hidden rounded-xl bg-card hover:bg-line/60">
                  {a.cover_art_url ? (
                    <CoverImage src={a.cover_art_url} alt={a.title} className="aspect-square w-full" />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center bg-card text-muted">
                      <Disc3 size={40} />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold group-hover:underline">{a.title}</p>
                    <p className="text-xs text-muted">{a.release_date?.slice(0, 4) ?? ""}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null,
      )}

      {loose.length > 0 && (
        <section>
          <h2 className="mb-2 text-xl font-extrabold">Loose tracks</h2>
          <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal px-2">
            {loose.map((t, i) => (
              <SongRow key={t.id} track={t} tracks={loose} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

