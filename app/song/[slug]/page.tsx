import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchTrackBySlug, fetchSimilar } from "@/lib/catalog";
import { formatTime } from "@/lib/utils";
import { SongGrid, SongRow } from "@/components/SongCard";
import CoverImage from "@/components/CoverImage";
import { Music2 } from "lucide-react";
import LikeButton from "@/components/LikeButton";
import { PlayAllButton, LyricsEntryButton } from "@/components/PlayControls";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const track = await fetchTrackBySlug((await params).slug);
  if (!track) return { title: "Not found" };
  return {
    title: `${track.title} — ${track.artistNames}`,
    description: `Listen to ${track.title} by ${track.artistNames} on MiniFM.`,
  };
}

export default async function SongPage({ params }: { params: Promise<{ slug: string }> }) {
  const track = await fetchTrackBySlug((await params).slug);
  if (!track) notFound();
  const similar = await fetchSimilar(track, [], 10);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row">
        {track.coverArt ? (
          <CoverImage
            src={track.coverArt}
            alt={track.title}
            eager
            className="aspect-square w-full max-w-xs rounded-2xl shadow-2xl"
          />
        ) : (
          <div className="grid aspect-square w-full max-w-xs place-items-center rounded-2xl bg-card text-muted">
            <Music2 size={72} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-black tracking-tight">{track.title}</h1>
          <p className="mt-1 text-muted">
            {track.artists.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ", "}
                <Link href={`/artist/${a.slug}`} className="hover:text-white hover:underline">
                  {a.name}
                </Link>
              </span>
            ))}
          </p>
          {track.album && (
            <p className="mt-1 text-sm text-muted">
              Album:{" "}
              <Link href={`/album/${track.album.slug}`} className="hover:text-white hover:underline">
                {track.album.title}
              </Link>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {track.genres.map((g) => (
              <Link key={g.id} href={`/genre/${g.slug}`} className="rounded-full bg-card px-3 py-1 hover:bg-line">
                {g.name}
              </Link>
            ))}
            {track.languageName && (
              <Link href={`/language/${track.languageCode}`} className="rounded-full bg-card px-3 py-1 hover:bg-line">
                {track.languageName}
              </Link>
            )}
            {track.isInstrumental && (
              <span className="rounded-full bg-card px-3 py-1">Instrumental</span>
            )}
          </div>
          <p className="mt-3 text-xs text-muted">
            {track.duration ? `${formatTime(track.duration)} · ` : ""}
            {track.playCount} plays
            {track.releaseDate ? ` · Released ${track.releaseDate}` : ""}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <PlayAllButton tracks={[track]} label="Play" />
            <LyricsEntryButton track={track} />
            <LikeButton songId={track.id} />
          </div>
        </div>
      </div>

      {similar.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-extrabold">More like this</h2>
          <p className="mb-3 text-xs text-muted">
            From our own catalog — shared genres and language.
          </p>
          <div className="hidden md:block">
            <SongGrid tracks={similar.slice(0, 5)} />
          </div>
          <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal px-2 md:hidden">
            {similar.slice(0, 5).map((t, i) => (
              <SongRow key={t.id} track={t} tracks={similar} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
