import { experimental_evaluate as evaluate } from "ai";

/**
 * Language detection for the upload pipeline (MusicBrainz has no language
 * data). Two layers:
 * 1. Jev choice question over the live `languages` table, with title, album,
 *    artist names, genres and a lyrics excerpt as state.
 * 2. Script heuristic fallback (no network/AI needed): kana → ja, hangul →
 *    ko, devanagari → hi, etc. Latin-only text returns null (stays "en").
 */

const NATIVE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi (हिन्दी)",
  zh: "Chinese (中文)",
  es: "Spanish (Español)",
  pa: "Punjabi (ਪੰਜਾਬੀ)",
  ta: "Tamil (தமிழ்)",
  te: "Telugu (తెలుగు)",
  fr: "French (Français)",
  ko: "Korean (한국어)",
  ja: "Japanese (日本語, kana/kanji)",
  pt: "Portuguese (Português)",
  de: "German (Deutsch)",
  it: "Italian (Italiano)",
  ml: "Malayalam (മലയാളം)",
  bn: "Bengali (বাংলা)",
  mr: "Marathi (मराठी)",
  gu: "Gujarati (ગુજરાતી)",
  other: "Other, instrumental, or no vocals",
};

export function detectScriptLanguage(text: string): string | null {
  if (!text) return null;
  if (/[぀-ヿ]/.test(text)) return "ja"; // hiragana + katakana
  if (/[가-힯ᄀ-ᇿ]/.test(text)) return "ko"; // hangul
  if (/[ऀ-ॿ]/.test(text)) return "hi"; // devanagari
  if (/[ঀ-৿]/.test(text)) return "bn"; // bengali
  if (/[਀-੿]/.test(text)) return "pa"; // gurmukhi
  if (/[અ-૿]/.test(text)) return "gu"; // gujarati
  if (/[஀-௿]/.test(text)) return "ta"; // tamil
  if (/[ఀ-౿]/.test(text)) return "te"; // telugu
  if (/[ഀ-ൿ]/.test(text)) return "ml"; // malayalam
  return null;
}

export interface LanguageDetectInput {
  title: string;
  artists: string[];
  album?: string | null;
  genres: string[];
  lyricsExcerpt: string;
  languages: { code: string; name: string }[];
}

/** Jev `choice` over language codes. Returns null on any failure. */
export async function detectLanguageWithJev(
  input: LanguageDetectInput,
): Promise<string | null> {
  if (input.languages.length === 0) return null;
  const criteria: Record<string, string> = {};
  for (const l of input.languages.slice(0, 30)) {
    criteria[l.code] = NATIVE_NAMES[l.code] ?? l.name;
  }
  const state = {
    title: input.title,
    artists: input.artists,
    album: input.album ?? "",
    genres: input.genres,
    lyrics: input.lyricsExcerpt.slice(0, 1500),
  };
  // Nothing to judge from (no lyrics, latin-only short title)? Still ask —
  // artist names like "YOASOBI" alone can pin the language.
  try {
    const result = await evaluate({
      model: "typesafe-ai/jev-latest",
      state,
      questions: {
        language: {
          type: "choice",
          instructions:
            "Which language is this song sung in? Use the lyrics script and vocabulary first, then title/artist/album hints. Pick 'other' only for instrumentals or unlisted languages.",
          criteria,
        },
      },
    });
    const choice = result.answers.language.choice;
    return input.languages.some((l) => l.code === choice) ? choice : null;
  } catch {
    return null;
  }
}
