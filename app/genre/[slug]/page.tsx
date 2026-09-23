import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { fetchTracks, type SortKey } from "@/lib/catalog";
import { SongGrid } from "@/components/SongCard";
import { PlayAllButton } from "@/components/PlayControls";
import SortLinks from "@/components/SortLinks";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const db = supabaseAdmin();
  const { data } = await db.from("genres").select("name").eq("slug", (await params).slug).maybeSingle();
  return { title: data ? `${data.name} · Genre` : "Genre" };
}

export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const slug = (await params).slug;
  const sp = await searchParams;
  const sort = (Array.isArray(sp.sort) ? sp.sort[0] : sp.sort ?? "recent") as SortKey;
  const db = supabaseAdmin();
  const { data: genre } = await db.from("genres").select("*").eq("slug", slug).maybeSingle();
  if (!genre) notFound();
  const tracks = await fetchTracks({ genreId: genre.id, sort, limit: 100 });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-coal p-6">
        <p className="text-xs uppercase tracking-widest text-muted">Genre</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-black">{genre.name}</h1>
            <p className="mt-1 text-xs text-muted">
              {tracks.length} track{tracks.length === 1 ? "" : "s"}
            </p>
          </div>
          <PlayAllButton tracks={tracks} label={`Play ${genre.name}`} />
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <SortLinks base={`/genre/${slug}`} current={sort} />
        </div>
      </div>
      <SongGrid tracks={tracks} />
    </div>
  );
}
