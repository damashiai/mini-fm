import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Albums · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminAlbumsPage() {
  const db = supabaseAdmin();
  const { data: albums } = await db
    .from("albums")
    .select("id, title, slug, album_type, release_date")
    .order("title");
  const { data: songs } = await db
    .from("songs")
    .select("album_id")
    .in("album_id", (albums ?? []).map((a) => a.id));
  const counts = new Map<string, number>();
  for (const s of songs ?? []) {
    if (s.album_id) counts.set(s.album_id, (counts.get(s.album_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">Releases ({(albums ?? []).length})</h1>
      <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal">
        {(albums ?? []).map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{a.title}</p>
              <p className="text-xs text-muted">
                {a.album_type} · {counts.get(a.id) ?? 0} tracks
              </p>
            </div>
            <Link href={`/album/${a.slug}`} className="text-xs text-muted hover:text-white">
              View
            </Link>
            <Link href={`/admin/albums/${a.id}`} className="rounded-lg bg-card px-3 py-1.5 text-xs font-semibold hover:bg-line">
              Edit
            </Link>
          </div>
        ))}
        {(albums ?? []).length === 0 && <p className="p-6 text-sm text-muted">No releases yet — they appear when you upload.</p>}
      </div>
    </div>
  );
}
