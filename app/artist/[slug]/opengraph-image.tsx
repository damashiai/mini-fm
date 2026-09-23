import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase-server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ArtistOg({ params }: { params: Promise<{ slug: string }> }) {
  const db = supabaseAdmin();
  const { data } = await db.from("artists").select("name").eq("slug", (await params).slug).maybeSingle();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", background: "#141414", color: "#fff", padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 32, color: "#E50914", fontWeight: 800 }}>MiniFM · Artist</div>
        <div style={{ fontSize: 84, fontWeight: 900 }}>{(data?.name ?? "Artist").slice(0, 50)}</div>
      </div>
    ),
    { ...size },
  );
}
