import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase-server";
import { OgArt, OgCard, OgPlaceholder } from "@/components/OgImage";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function AlbumOg({ params }: { params: Promise<{ slug: string }> }) {
  const db = supabaseAdmin();
  const { data } = await db.from("albums").select("title, cover_art_url").eq("slug", (await params).slug).maybeSingle();
  return new ImageResponse(
    (
      <OgCard
        kicker="MiniFM"
        title={data?.title ?? "Album"}
        art={data?.cover_art_url ? <OgArt src={data.cover_art_url} size={300} /> : <OgPlaceholder size={300} />}
      />
    ),
    { ...size },
  );
}
