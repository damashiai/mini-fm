import Link from "next/link";
import { Headphones } from "lucide-react";
import { fetchTracks, usedFacets } from "@/lib/catalog";
import { supabaseAdmin } from "@/lib/supabase-server";
import MoodForm from "@/components/MoodForm";
import { SongGrid, SongRow } from "@/components/SongCard";
import HomeShelves from "@/components/HomeShelves";

export const dynamic = "force-dynamic";

/**
 * Homepage genre shelf: curated for diversity (anime / J-Pop / K-Pop / …)
 * rather than alphabetical, so the first screen already shows range.
 * Slugs missing from the DB are simply skipped; the list fills from the rest.
 */
const FEATURED_GENRE_SLUGS = [
  "anime",
  "j-pop",
  "k-pop",
  "city-pop",
  "lo-fi",
  "bollywood",
  "afrobeats",
  "hip-hop",
  "electronic",
  "synthwave",
  "rnb",
  "jazz",
];

function featuredGenres(rows: { id: string; name: string; slug: string }[]) {
  const rank = new Map(FEATURED_GENRE_SLUGS.map((s, i) => [s, i]));
  return [...rows]
    .sort(
      (a, b) =>
        (rank.get(a.slug) ?? 999) - (rank.get(b.slug) ?? 999) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 7);
}

export default async function HomePage() {
  const db = supabaseAdmin();
  const [{ data: genreRows }, recent, played, used] = await Promise.all([
    db.from("genres").select("id, name, slug").order("name"),
    fetchTracks({ sort: "recent", limit: 10 }),
    fetchTracks({ sort: "played", limit: 10 }),
    usedFacets(),
  ]);
  // Homepage shelf: curated for diversity, but only genres that have songs.
  const featured = featuredGenres(genreRows ?? []).filter((g) => used.genreIds.has(g.id));

  return (
    <div className="space-y-10">
      <MoodForm />

      {/* Manual explore is a first-class entry point, not a fallback. */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-extrabold">Explore the catalog</h2>
          <Link href="/explore" className="text-sm text-muted hover:text-white">
            Browse all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Link
            href="/explore"
            className="rounded-xl border border-line bg-coal p-4 font-semibold transition hover:border-brand"
          >
            <span className="flex items-center gap-2">
              <Headphones size={18} className="text-brand" /> All music
            </span>
            <span className="mt-1 block text-xs font-normal text-muted">Search, filter & sort</span>
          </Link>
          {(featured).map((g) => (
            <Link
              key={g.id}
              href={`/genre/${g.slug}`}
              className="rounded-xl border border-line bg-coal p-4 font-semibold transition hover:border-brand"
            >
              {g.name}
              <span className="block text-xs font-normal text-muted">Genre mix</span>
            </Link>
          ))}
          {featured.length === 0 && (
            <p className="col-span-full rounded-xl border border-line bg-coal p-4 text-sm text-muted">
              No music in the catalog yet — check back soon.
            </p>
          )}
        </div>
      </section>

      <HomeShelves />

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-extrabold">Most played</h2>
          <Link href="/charts" className="text-sm text-muted hover:text-white">
            Full charts →
          </Link>
        </div>
        <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal px-2">
          {played.slice(0, 5).map((t, i) => (
            <SongRow key={t.id} track={t} tracks={played} index={i} rank={i + 1} />
          ))}
          {played.length === 0 && (
            <p className="p-4 text-sm text-muted">No plays yet — be the first.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-extrabold">Fresh drops</h2>
        <SongGrid tracks={recent} />
      </section>
    </div>
  );
}
