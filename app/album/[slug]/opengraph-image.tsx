import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase-server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function AlbumOg({ params }: { params: Promise<{ slug: string }> }) {
  const db = supabaseAdmin();
  const { data } = await db.from("albums").select("title, cover_art_url").eq("slug", (await params).slug).maybeSingle();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 48, background: "#141414", color: "#fff", padding: 64, fontFamily: "sans-serif" }}>
        {data?.cover_art_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.cover_art_url} width={320} height={320} style={{ borderRadius: 24 }} />
        ) : (
          <div style={{ width: 320, height: 320, borderRadius: 24, background: "#E50914" }} />
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 32, color: "#E50914", fontWeight: 800 }}>MiniFM</div>
          <div style={{ fontSize: 72, fontWeight: 900 }}>{(data?.title ?? "Album").slice(0, 60)}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
