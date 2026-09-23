import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-server";
import SignOutButton from "@/components/SignOutButton";
import StorageJanitorButton from "@/components/StorageJanitorButton";
import ClearHistoryButton from "@/components/ClearHistoryButton";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const db = supabaseAdmin();
  const [{ count: songCount }, { count: artistCount }, { count: albumCount }, { count: playCount }, { data: songs }] =
    await Promise.all([
      db.from("songs").select("id", { count: "exact", head: true }),
      db.from("artists").select("id", { count: "exact", head: true }),
      db.from("albums").select("id", { count: "exact", head: true }),
      db.from("plays").select("id", { count: "exact", head: true }),
      db.from("songs").select("id, title, slug, play_count, created_at").order("created_at", { ascending: false }).limit(50),
    ]);

  // Artist names for the table.
  const { data: links } = await db
    .from("song_artists")
    .select("song_id, artists (name)")
    .in("song_id", (songs ?? []).map((s) => s.id));
  const names = new Map<string, string>();
  for (const l of links ?? []) {
    const n = (l.artists as unknown as { name: string } | null)?.name;
    if (!n) continue;
    names.set(l.song_id, names.has(l.song_id) ? `${names.get(l.song_id)}, ${n}` : n);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Admin</h1>
        <div className="flex gap-2">
          <Link href="/admin/upload" className="rounded-lg bg-brand px-4 py-2 text-sm font-bold hover:bg-brandDark">
            Upload music
          </Link>
          <SignOutButton />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Songs", songCount ?? 0],
          ["Artists", artistCount ?? 0],
          ["Albums", albumCount ?? 0],
          ["Plays", playCount ?? 0],
        ].map(([label, n]) => (
          <div key={label as string} className="rounded-xl border border-line bg-coal p-4">
            <p className="text-2xl font-black">{n}</p>
            <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-lg font-bold">Manage</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Songs", "/admin#tracks", `${songCount ?? 0}`],
            ["Artists", "/admin/artists", `${artistCount ?? 0}`],
            ["Releases", "/admin/albums", `${albumCount ?? 0}`],
            ["Genres", "/admin/genres", ""],
          ].map(([label, href, sub]) => (
            <Link
              key={label as string}
              href={href as string}
              className="rounded-xl border border-line bg-coal p-4 transition hover:border-brand"
            >
              <p className="font-bold">{label}</p>
              <p className="text-xs text-muted">{sub ? `${sub} total` : "Rename, add, remove"}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StorageJanitorButton />
        <ClearHistoryButton />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-coal p-4">
          <p className="font-semibold">Uploads are content-addressed</p>
          <p className="mt-1 text-xs text-muted">
            Identical audio/image bytes always land on the same storage object
            (`tracks/&lt;sha256&gt;`, `covers/&lt;sha256&gt;`) — retries and
            re-drops reuse the file instead of duplicating it.
          </p>
        </div>
      </div>

      <section id="tracks">
        <h2 className="mb-2 text-lg font-bold">Latest tracks</h2>
        <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal">
          {(songs ?? []).map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.title}</p>
                <p className="truncate text-xs text-muted">
                  {names.get(s.id) ?? "—"} · {s.play_count} plays
                </p>
              </div>
              <Link href={`/song/${s.slug}`} className="text-xs text-muted hover:text-white">
                View
              </Link>
              <Link href={`/admin/songs/${s.id}`} className="rounded-lg bg-card px-3 py-1.5 text-xs font-semibold hover:bg-line">
                Edit
              </Link>
            </div>
          ))}
          {(songs ?? []).length === 0 && (
            <p className="p-6 text-sm text-muted">
              Catalog is empty — <Link href="/admin/upload" className="text-brand hover:underline">upload your first tracks</Link>.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
