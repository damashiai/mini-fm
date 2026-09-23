import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { shortId } from "@/lib/utils";

/**
 * Persist-on-save only: generated mood playlists are NOT written until the
 * user taps Save/Share. expires_at = now + 7 days; a daily Vercel Cron
 * (app/api/cron/cleanup-playlists) deletes expired rows.
 */
export async function POST(req: Request) {
  try {
    const { moodPrompt, matchedGenreIds, songIds } = (await req.json()) as {
      moodPrompt?: string;
      matchedGenreIds?: string[];
      songIds?: string[];
    };
    if (!moodPrompt || !songIds?.length) {
      return NextResponse.json({ error: "nothing to save" }, { status: 400 });
    }
    const db = supabaseAdmin();
    for (let attempt = 0; attempt < 3; attempt++) {
      const shareSlug = shortId(8);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await db
        .from("playlists")
        .insert({
          mood_prompt: moodPrompt.slice(0, 500),
          matched_genre_ids: matchedGenreIds ?? [],
          song_ids: songIds.slice(0, 30),
          share_slug: shareSlug,
          expires_at: expiresAt,
        })
        .select("share_slug, expires_at")
        .maybeSingle();
      if (!error && data) {
        return NextResponse.json({
          shareSlug: data.share_slug,
          url: `/playlist/${data.share_slug}`,
          expiresAt: data.expires_at,
        });
      }
      // Slug collision (astronomically unlikely) → retry with a fresh one.
      if (error && !/duplicate|unique/i.test(error.message)) {
        return NextResponse.json({ error: "save failed" }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
}
