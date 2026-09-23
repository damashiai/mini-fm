import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase-server";
import { OgCard } from "@/components/OgImage";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ArtistOg({ params }: { params: Promise<{ slug: string }> }) {
  const db = supabaseAdmin();
  const { data } = await db.from("artists").select("name").eq("slug", (await params).slug).maybeSingle();
  return new ImageResponse(
    <OgCard kicker="MiniFM · Artist" title={data?.name ?? "Artist"} />,
    { ...size },
  );
}
