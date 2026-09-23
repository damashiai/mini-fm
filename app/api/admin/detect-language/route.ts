import { NextResponse } from "next/server";
import { detectLanguageWithJev, detectScriptLanguage } from "@/lib/language-detect";
import { requireAdmin } from "../_auth";

/**
 * Language detection for uploads (MusicBrainz carries no language data):
 * Jev classifies title/album/artists/genres + lyrics excerpt against the live
 * `languages` table, with a unicode-script heuristic as fallback. The admin
 * review form stays editable — this only pre-fills.
 */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  try {
    const { title, artists, album, genres, lyricsText } = (await req.json()) as {
      title?: string;
      artists?: string[];
      album?: string | null;
      genres?: string[];
      lyricsText?: string;
    };
    const { data: languages } = await gate.db.from("languages").select("code, name");
    const codes = new Set((languages ?? []).map((l) => l.code));

    let code = await detectLanguageWithJev({
      title: title ?? "",
      artists: artists ?? [],
      album: album ?? null,
      genres: genres ?? [],
      lyricsExcerpt: lyricsText ?? "",
      languages: languages ?? [],
    });
    let source = "jev";
    if (!code || !codes.has(code)) {
      code = detectScriptLanguage(`${title ?? ""}\n${lyricsText ?? ""}`);
      source = code && codes.has(code) ? "script" : "none";
      if (!code || !codes.has(code)) code = null;
    }
    return NextResponse.json({ languageCode: code, source });
  } catch {
    return NextResponse.json({ languageCode: null, source: "none" });
  }
}
