import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import { fetchTracksByIds } from "@/lib/catalog";
import { SongRow } from "@/components/SongCard";
import { PlayAllButton } from "@/components/PlayControls";

export const metadata: Metadata = { title: "Charts" };
export const dynamic = "force-dynamic";

/**
 * Real most-played ranking from the plays table — both all-time and a
 * rolling 30-day window (plays.played_at makes the window trivial).
 */
async function ranked(windowDays: number | null, limit = 20) {
  const db = supabaseAdmin();
  let q = db.from("plays").select("song_id").order("played_at", { ascending: false });
  if (windowDays) {
    q = q.gte("played_at", new Date(Date.now() - windowDays * 86_400_000).toISOString());
  }
  const { data } = await q.limit(2000);
  const counts = new Map<string, number>();
  for (const r of data ?? []) counts.set(r.song_id, (counts.get(r.song_id) ?? 0) + 1);
  const ids = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  const tracks = await fetchTracksByIds(ids);
  const plays = new Map(ids.map((id) => [id, counts.get(id) ?? 0]));
  return { tracks, plays };
}

export default async function ChartsPage() {
  const [allTime, recent] = await Promise.all([ranked(null), ranked(30)]);
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <h1 className="text-2xl font-black">Charts</h1>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Trending · last 30 days</h2>
          <PlayAllButton tracks={recent.tracks} label="Play" />
        </div>
        {recent.tracks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal px-2">
            {recent.tracks.map((t, i) => (
              <div key={t.id} className="flex items-center gap-1">
                <span className="min-w-0 flex-1">
                  <SongRow track={{ ...t, playCount: recent.plays.get(t.id) ?? t.playCount }} tracks={recent.tracks} index={i} rank={i + 1} />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">All time</h2>
          <PlayAllButton tracks={allTime.tracks} label="Play" />
        </div>
        {allTime.tracks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal px-2">
            {allTime.tracks.map((t, i) => (
              <div key={t.id}>
                <SongRow track={{ ...t, playCount: allTime.plays.get(t.id) ?? t.playCount }} tracks={allTime.tracks} index={i} rank={i + 1} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-line bg-coal p-8 text-center text-sm text-muted">
      No plays recorded yet — press play on anything and come back.
    </div>
  );
}
