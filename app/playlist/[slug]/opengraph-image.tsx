import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase-server";
import { fetchTracksByIds } from "@/lib/catalog";
import { OgCard } from "@/components/OgImage";

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
  const covers = tracks.filter((t) => t.coverArt).slice(0, 3);
  return new ImageResponse(
    (
      <OgCard
        kicker="MiniFM · Shared mix"
        title={`“${data?.mood_prompt ?? "Mood mix"}”`}
        subtitle={`${(data?.song_ids ?? []).length} tracks`}
        art={
          covers.length > 0 ? (
            <div style={{ display: "flex" }}>
              {covers.map((t) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={t.id}
                  src={t.coverArt!}
                  width={160}
                  height={160}
                  style={{ borderRadius: 18, marginRight: -48, border: "5px solid #141414" }}
                />
              ))}
            </div>
          ) : undefined
        }
      />
    ),
    { ...size },
  );
}
