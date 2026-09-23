import { ImageResponse } from "next/og";
import { fetchTrackBySlug } from "@/lib/catalog";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function SongOg({ params }: { params: Promise<{ slug: string }> }) {
  const track = await fetchTrackBySlug((await params).slug);
  const title = track?.title ?? "MiniFM";
  const artist = track?.artistNames ?? "moods into music";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 48,
          background: "#141414",
          color: "#fff",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        {track?.coverArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.coverArt} width={320} height={320} style={{ borderRadius: 24 }} />
        ) : (
          <div style={{ width: 320, height: 320, borderRadius: 24, background: "#E50914" }} />
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 32, color: "#E50914", fontWeight: 800 }}>MiniFM</div>
          <div style={{ fontSize: 72, fontWeight: 900 }}>{title.slice(0, 60)}</div>
          <div style={{ fontSize: 36, color: "#a3a3a3" }}>{artist.slice(0, 80)}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
