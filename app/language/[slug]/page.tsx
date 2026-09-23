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
  const { data } = await db.from("languages").select("name").eq("code", (await params).slug).maybeSingle();
  return { title: data ? `${data.name} · Language` : "Language" };
}

export default async function LanguagePage({
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
  const { data: lang } = await db.from("languages").select("*").eq("code", slug).maybeSingle();
  if (!lang) notFound();
  const tracks = await fetchTracks({ languageCode: lang.code, sort, limit: 100 });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-coal p-6">
        <p className="text-xs uppercase tracking-widest text-muted">Language</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-black">{lang.name}</h1>
            <p className="mt-1 text-xs text-muted">
              {tracks.length} track{tracks.length === 1 ? "" : "s"}
            </p>
          </div>
          <PlayAllButton tracks={tracks} label={`Play ${lang.name}`} />
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <SortLinks base={`/language/${slug}`} current={sort} />
        </div>
      </div>
      <SongGrid tracks={tracks} />
    </div>
  );
}
