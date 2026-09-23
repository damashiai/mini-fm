import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { fetchTracksByIds } from "@/lib/catalog";
import { SongRow } from "@/components/SongCard";
import { PlayAllButton } from "@/components/PlayControls";
import SharePlaylistButton from "@/components/SharePlaylistButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("playlists")
    .select("mood_prompt")
    .eq("share_slug", (await params).slug)
    .maybeSingle();
  return {
    title: data ? `Mix for “${data.mood_prompt.slice(0, 60)}”` : "Shared playlist",
    description: "A MiniFM mood mix — listen free, no account needed.",
  };
}

export default async function PlaylistPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const db = supabaseAdmin();
  const { data: row } = await db
    .from("playlists")
    .select("*")
    .eq("share_slug", slug)
    .maybeSingle();
  if (!row || new Date(row.expires_at).getTime() < Date.now()) notFound();

  const tracks = await fetchTracksByIds(row.song_ids ?? []);
  const { data: genreRows } = await db
    .from("genres")
    .select("name")
    .in("id", row.matched_genre_ids?.length ? row.matched_genre_ids : ["00000000-0000-0000-0000-000000000000"]);
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(row.expires_at).getTime() - Date.now()) / 86_400_000),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-line bg-gradient-to-br from-coal to-[#2a0d10] p-6">
        <p className="text-xs uppercase tracking-widest text-muted">Shared mood mix</p>
        <h1 className="mt-1 text-2xl font-black">“{row.mood_prompt}”</h1>
        {(genreRows ?? []).length > 0 && (
          <p className="mt-1 text-sm text-muted">
            {(genreRows ?? []).map((g) => g.name).join(" · ")}
          </p>
        )}
        <p className="mt-1 text-xs text-muted">Expires in {daysLeft} day{daysLeft === 1 ? "" : "s"}</p>
        <div className="mt-4 flex gap-2">
          <PlayAllButton tracks={tracks} label="Play mix" />
          <SharePlaylistButton />
        </div>
      </div>
      <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal px-2">
        {tracks.map((t, i) => (
          <SongRow key={t.id} track={t} tracks={tracks} index={i} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
