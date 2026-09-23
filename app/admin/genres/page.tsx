import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import GenreManager from "@/components/GenreManager";

export const metadata: Metadata = { title: "Genres · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminGenresPage() {
  const db = supabaseAdmin();
  const [{ data: genres }, { data: links }] = await Promise.all([
    db.from("genres").select("id, name, slug").order("name"),
    db.from("song_genres").select("genre_id").limit(5000),
  ]);
  const counts = new Map<string, number>();
  for (const l of links ?? []) counts.set(l.genre_id, (counts.get(l.genre_id) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-black">Genres</h1>
        <p className="text-sm text-muted">
          Renaming keeps the URL slug stable. Deleting unlinks songs (songs are kept).
        </p>
      </div>
      <GenreManager
        initial={(genres ?? []).map((g) => ({ ...g, songCount: counts.get(g.id) ?? 0 }))}
      />
    </div>
  );
}
