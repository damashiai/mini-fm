import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase-server";
import { fetchTracksByIds } from "@/lib/catalog";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function PlaylistOg({ params }: { params: Promise<{ slug: string }> }) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("playlists")
    .select("mood_prompt, song_ids")
    .eq("share_slug", (await params).slug)
    .maybeSingle();
  const tracks = data ? await fetchTracksByIds((data.song_ids ?? []).slice(0, 4)) : [];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 48, background: "#141414", color: "#fff", padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex" }}>
          {tracks.map((t) =>
            t.coverArt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={t.id} src={t.coverArt} width={150} height={150} style={{ borderRadius: 16, marginRight: -40, border: "4px solid #141414" }} />
            ) : null,
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 32, color: "#E50914", fontWeight: 800 }}>MiniFM · Shared mix</div>
          <div style={{ fontSize: 64, fontWeight: 900 }}>“{(data?.mood_prompt ?? "Mood mix").slice(0, 70)}”</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
