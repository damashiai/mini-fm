import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Artists · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminArtistsPage() {
  const db = supabaseAdmin();
  const { data: artists } = await db.from("artists").select("id, name, slug").order("name");
  const { data: links } = await db
    .from("song_artists")
    .select("artist_id")
    .in("artist_id", (artists ?? []).map((a) => a.id));
  const counts = new Map<string, number>();
  for (const l of links ?? []) counts.set(l.artist_id, (counts.get(l.artist_id) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">Artists ({(artists ?? []).length})</h1>
      <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal">
        {(artists ?? []).map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{a.name}</p>
              <p className="text-xs text-muted">{counts.get(a.id) ?? 0} songs</p>
            </div>
            <Link href={`/artist/${a.slug}`} className="text-xs text-muted hover:text-white">
              View
            </Link>
            <Link href={`/admin/artists/${a.id}`} className="rounded-lg bg-card px-3 py-1.5 text-xs font-semibold hover:bg-line">
              Edit
            </Link>
          </div>
        ))}
        {(artists ?? []).length === 0 && <p className="p-6 text-sm text-muted">No artists yet — they appear when you upload.</p>}
      </div>
    </div>
  );
}
