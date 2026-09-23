import { ImageResponse } from "next/og";
import { fetchTrackBySlugOrId } from "@/lib/catalog";
import { OgArt, OgCard, OgPlaceholder } from "@/components/OgImage";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function SongOg({ params }: { params: Promise<{ slug: string }> }) {
  const track = await fetchTrackBySlugOrId((await params).slug);
  return new ImageResponse(
    (
      <OgCard
        kicker="MiniFM"
        title={track?.title ?? "MiniFM"}
        subtitle={track?.artistNames ?? "moods into music"}
        art={track?.coverArt ? <OgArt src={track.coverArt} size={300} /> : <OgPlaceholder size={300} />}
      />
    ),
    { ...size },
  );
}
