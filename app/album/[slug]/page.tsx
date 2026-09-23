import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { fetchTracks } from "@/lib/catalog";
import { SongRow } from "@/components/SongCard";
import CoverImage from "@/components/CoverImage";
import { Disc3 } from "lucide-react";
import { PlayAllButton } from "@/components/PlayControls";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const db = supabaseAdmin();
  const { data } = await db.from("albums").select("title").eq("slug", (await params).slug).maybeSingle();
  return { title: data ? `${data.title}` : "Album" };
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const db = supabaseAdmin();
  const { data: album } = await db
    .from("albums")
    .select("*")
    .eq("slug", (await params).slug)
    .maybeSingle();
  if (!album) notFound();

  const { data: artistLinks } = await db
    .from("album_artists")
    .select("artists (id, name, slug)")
    .eq("album_id", album.id);
  const artists = (artistLinks ?? [])
    .map((l) => l.artists as unknown as { id: string; name: string; slug: string } | null)
    .filter((a): a is { id: string; name: string; slug: string } => !!a);

  const all = await fetchTracks({ sort: "recent", limit: 500 });
  const tracks = all.filter((t) => t.album?.id === album.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row">
        {album.cover_art_url ? (
          <CoverImage
            src={album.cover_art_url}
            alt={album.title}
            eager
            className="aspect-square w-full max-w-xs rounded-2xl shadow-2xl"
          />
        ) : (
          <div className="grid aspect-square w-full max-w-xs place-items-center rounded-2xl bg-card text-muted">
            <Disc3 size={72} />
          </div>
        )}
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">{album.album_type}</p>
          <h1 className="mt-1 text-3xl font-black">{album.title}</h1>
          <p className="mt-1 text-muted">
            {artists.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ", "}
                <Link href={`/artist/${a.slug}`} className="hover:text-white hover:underline">{a.name}</Link>
              </span>
            ))}
          </p>
          {album.release_date && <p className="mt-1 text-sm text-muted">Released {album.release_date}</p>}
          <div className="mt-4">
            <PlayAllButton tracks={tracks} label="Play album" />
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-xl font-extrabold">Tracklist</h2>
        {tracks.length === 0 ? (
          <p className="text-sm text-muted">No tracks linked to this release yet.</p>
        ) : (
          <ol className="divide-y divide-line/60 rounded-xl border border-line bg-coal px-2">
            {tracks.map((t, i) => (
              <li key={t.id} className="flex items-center gap-1">
                <span className="w-7 shrink-0 text-center text-sm tabular-nums text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <SongRow track={t} tracks={tracks} index={i} />
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
