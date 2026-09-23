import Link from "next/link";
import { fetchTracks, usedFacets, type SortKey } from "@/lib/catalog";
import { supabaseAdmin } from "@/lib/supabase-server";
import { SongGrid } from "@/components/SongCard";
import ExploreFilters from "@/components/ExploreFilters";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ExplorePage({ searchParams }: Props) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = (one(sp.q) ?? "").trim();
  const genreSlug = one(sp.genre);
  const language = one(sp.language);
  const artistId = one(sp.artist);
  const decade = one(sp.decade);
  const sort = (one(sp.sort) ?? "recent") as SortKey;

  const db = supabaseAdmin();
  const [{ data: genreRows }, { data: langRows }, { data: artistRows }, used] = await Promise.all([
    db.from("genres").select("id, name, slug").order("name"),
    db.from("languages").select("code, name").order("name"),
    db.from("artists").select("id, name").order("name").limit(200),
    usedFacets(),
  ]);
  // Only offer facets that actually have songs behind them.
  const genres = (genreRows ?? []).filter((g) => used.genreIds.has(g.id));
  const languages = (langRows ?? []).filter((l) => used.languageCodes.has(l.code));
  const artists = (artistRows ?? []).filter((a) => used.artistIds.has(a.id));
  const genreId = genreSlug
    ? (genreRows ?? []).find((g) => g.slug === genreSlug)?.id
    : undefined;

  // Real search across songs, artists and albums: artist/album name matches
  // expand into their song ids, unioned with direct title matches.
  let searchIds: string[] | undefined;
  let searchedArtists: { id: string; name: string; slug: string }[] = [];
  let searchedAlbums: { id: string; title: string; slug: string; cover_art_url: string | null }[] = [];
  if (q) {
    const [{ data: artistMatch }, { data: albumMatch }] = await Promise.all([
      db.from("artists").select("id, name, slug").ilike("name", `%${q}%`).limit(12),
      db.from("albums").select("id, title, slug, cover_art_url").ilike("title", `%${q}%`).limit(12),
    ]);
    searchedArtists = (artistMatch ?? []).filter((a) => used.artistIds.has(a.id));
    searchedAlbums = albumMatch ?? [];
    const idSet = new Set<string>();
    if (searchedArtists.length) {
      const { data } = await db
        .from("song_artists")
        .select("song_id")
        .in("artist_id", searchedArtists.map((a) => a.id));
      (data ?? []).forEach((r) => idSet.add(r.song_id));
    }
    if (searchedAlbums.length) {
      const { data } = await db
        .from("songs")
        .select("id")
        .in("album_id", searchedAlbums.map((a) => a.id));
      (data ?? []).forEach((r) => idSet.add(r.id));
    }
    const { data: titleMatch } = await db.from("songs").select("id").ilike("title", `%${q}%`).limit(60);
    (titleMatch ?? []).forEach((r) => idSet.add(r.id));
    searchIds = [...idSet];
  }

  let tracks = searchIds
    ? searchIds.length > 0
      ? await fetchTracks({ sort, limit: 60 }).then((all) => {
          // Intersect: apply remaining filters to the search result set.
          const set = new Set(searchIds);
          return all.filter((t) => set.has(t.id));
        })
      : []
    : await fetchTracks({ genreId, languageCode: language, artistId, decade, sort, limit: 60 });

  // When searching AND filtering, apply the extra filters on top.
  if (searchIds && (genreId || language || artistId || decade)) {
    const filtered = await fetchTracks({ genreId, languageCode: language, artistId, decade, sort, limit: 200 });
    const keep = new Set(filtered.map((t) => t.id));
    tracks = tracks.filter((t) => keep.has(t.id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Explore</h1>
        <p className="text-sm text-muted">
          Browse everything — no mood input required.
        </p>
      </div>
      <ExploreFilters
        options={{
          genres,
          languages,
          artists,
          decades: used.decades,
        }}
      />

      {q && (
        <div className="space-y-4">
          {searchedArtists.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted">Artists</h2>
              <div className="flex flex-wrap gap-2">
                {searchedArtists.map((a) => (
                  <Link key={a.id} href={`/artist/${a.slug}`} className="rounded-full border border-line bg-coal px-4 py-1.5 text-sm hover:border-brand">
                    {a.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {searchedAlbums.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted">Albums</h2>
              <div className="flex flex-wrap gap-2">
                {searchedAlbums.map((a) => (
                  <Link key={a.id} href={`/album/${a.slug}`} className="rounded-full border border-line bg-coal px-4 py-1.5 text-sm hover:border-brand">
                    {a.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted">
            Songs matching “{q}” ({tracks.length})
          </h2>
        </div>
      )}

      <SongGrid tracks={tracks} />
    </div>
  );
}
