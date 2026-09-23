import { experimental_evaluate as evaluate } from "ai";
import type { Genre } from "./db-types";

/**
 * Mood → genre classification via Jev (TypeSafe AI's decision model) through
 * Vercel AI Gateway + the AI SDK `experimental_evaluate` API.
 *
 * Verified against ai@7 docs (see README "AI notes"):
 *   evaluate({ model: 'typesafe-ai/jev-latest', state, questions: {
 *     primary:     { type: 'choice',  instructions, criteria: { slug: desc } },
 *     energy:      { type: 'score',   instructions, criteria: ['Low', ...] },
 *     instrumental:{ type: 'boolean', instructions } } })
 * Answers: choice -> { choice, probabilities? }, score -> { score },
 *          boolean -> { probability }.
 * Auth: automatic OIDC on Vercel deploys; AI_GATEWAY_API_KEY for local dev.
 *
 * Jev does NOT generate prose — it is only used for classification/scoring.
 * If the model is unreachable/unconfigured, we fall back to a tiny keyword
 * matcher so the mood path still works (manual explore never depends on AI).
 */

export interface MoodVerdict {
  primaryGenreId: string;
  primaryGenreSlug: string;
  secondaryGenreId: string | null;
  secondaryGenreSlug: string | null;
  energy: number; // 0..1 normalized score
  instrumentalPref: boolean;
  source: "jev" | "keyword-fallback";
}

/**
 * Origin + sound + use-case hints per genre. Without these, short prompts
 * ("korea", "gym", "sleep") collapse onto lookalike options.
 */
const GENRE_HINTS: Record<string, string> = {
  pop: "Pop: mainstream chart hits, catchy choruses, any country",
  rock: "Rock: guitars, drums, bands — classic to alternative",
  "hip-hop": "Hip-Hop: rap verses, trap beats, MCs and flow",
  rnb: "R&B: smooth slow jams, soulful singing, romance",
  electronic: "Electronic/EDM: synths, drops, DJ sets, techno and house",
  "lo-fi": "Lo-Fi: dusty chill beats for studying, relaxing, sleeping",
  jazz: "Jazz: swing, sax, improv, brunch and late bars",
  classical: "Classical: orchestra, symphony, piano concertos",
  ambient: "Ambient: beatless drones and textures for sleep and meditation",
  folk: "Folk: acoustic guitars, storytelling, campfire songs",
  country: "Country: twang, trucks, honky-tonk storytelling",
  metal: "Metal: heavy, loud, aggressive guitars and screaming",
  punk: "Punk: fast, raw, rebellious three-chord energy",
  reggae: "Reggae/dub from Jamaica: offbeat grooves, island feel",
  latin: "Latin: reggaeton, salsa, Spanish/Portuguese-language party music",
  "k-pop": "K-Pop from South Korea: Korean idol groups, Korean-language dance pop (BTS, BLACKPINK, Stray Kids)",
  "j-pop": "J-Pop from Japan: mainstream Japanese pop (YOASOBI, Kenshi Yonezu)",
  anime: "Anime music from Japan: animation openings, endings and inserts",
  "city-pop": "City Pop from Japan: 80s Japanese funk, disco and groove",
  bollywood: "Bollywood from India: Hindi film songs, desi party",
  devotional: "Indian devotional: bhajan, aarti, spiritual prayer music",
  afrobeats: "Afrobeats from Nigeria/Ghana: amapiano-adjacent dance grooves",
  synthwave: "Synthwave: retro 80s synths, night drives, outrun",
  phonk: "Phonk: dark Memphis-style beats, drift and night-drive music",
  indie: "Indie: independent/bedroom pop-rock, underground feel",
  soul: "Soul: emotional powerhouse vocals, heartbreak and devotion",
};

const KEYWORD_MAP: { words: string[]; slug: string }[] = [  { words: ["workout", "gym", "run", "pump", "hype", "party", "dance"], slug: "pop" },
  { words: ["sad", "cry", "heartbreak", "lonely", "blue", "melancholy"], slug: "soul" },
  { words: ["chill", "relax", "calm", "sleep", "study", "focus", "lofi"], slug: "lo-fi" },
  { words: ["meditat", "sleep", "ambient", "spa", "drone"], slug: "ambient" },
  { words: ["angry", "rage", "metal", "scream", "mosh"], slug: "metal" },
  { words: ["rock", "guitar", "garage", "band"], slug: "rock" },
  { words: ["rap", "hip", "hop", "trap", "bars", "flow"], slug: "hip-hop" },
  { words: ["romantic", "love", "date", "r&b", "rnb", "slow jam"], slug: "rnb" },
  { words: ["jazz", "swing", "sax", "brunch"], slug: "jazz" },
  { words: ["classical", "orchestra", "symphony", "piano concerto"], slug: "classical" },
  { words: ["folk", "acoustic", "campfire", "singer-songwriter"], slug: "folk" },
  { words: ["country", "truck", "honky"], slug: "country" },
  { words: ["punk", "rebel", "anarchy"], slug: "punk" },
  { words: ["reggae", "dub", "island", "beach"], slug: "reggae" },
  { words: ["latin", "salsa", "reggaeton", "fiesta", "spanish", "bad bunny"], slug: "latin" },
  { words: ["kpop", "k-pop", "bts", "korea", "korean", "blackpink", "stray kids", "seoul"], slug: "k-pop" },
  { words: ["j-pop", "jpop", "japan", "japanese", "city pop", "vocaloid", "yoasobi", "kenshi", "tokyo"], slug: "j-pop" },
  { words: ["anime", "anison", "opening", "ending", "otaku", "ghibli", "your name"], slug: "anime" },
  { words: ["afrobeat", "afrobeats", "amapiano", "burna", "wizkid", "nigeria", "lagos"], slug: "afrobeats" },
  { words: ["synthwave", "retrowave", "outrun", "80s synth"], slug: "synthwave" },
  { words: ["phonk", "drift", "night drive"], slug: "phonk" },
  { words: ["bollywood", "desi", "bhangra", "punjabi", "india", "hindi", "mumbai"], slug: "bollywood" },
  { words: ["bhajan", "devotional", "aarti", "spiritual", "prayer"], slug: "devotional" },
  { words: ["indie", "underground", "bedroom pop"], slug: "indie" },
  { words: ["electronic", "edm", "techno", "house", "rave", "synth"], slug: "electronic" },
];

export function keywordVerdict(mood: string, genres: Genre[]): MoodVerdict | null {
  const text = mood.toLowerCase();
  const bySlug = new Map(genres.map((g) => [g.slug, g]));
  const hits: Genre[] = [];
  for (const entry of KEYWORD_MAP) {
    if (entry.words.some((w) => text.includes(w))) {
      const g = bySlug.get(entry.slug);
      if (g && !hits.some((h) => h.id === g.id)) hits.push(g);
    }
  }
  const primary = hits[0] ?? genres[0];
  if (!primary) return null;
  const secondary = hits[1] ?? null;
  return {
    primaryGenreId: primary.id,
    primaryGenreSlug: primary.slug,
    secondaryGenreId: secondary?.id ?? null,
    secondaryGenreSlug: secondary?.slug ?? null,
    energy: /chill|relax|calm|sleep|calm|soft/i.test(mood) ? 0.25 : 0.6,
    instrumentalPref: /instrumental|no lyrics|no vocals|focus|study/i.test(mood),
    source: "keyword-fallback",
  };
}

export async function classifyMood(
  mood: string,
  genres: Genre[],
): Promise<MoodVerdict | null> {
  if (genres.length === 0) return null;
  // Bare "Name music" criteria make Jev guess across lookalikes ("korea" →
  // anime). Origin + sound + use-case hints pin each option down.
  const criteria: Record<string, string> = {};
  for (const g of genres.slice(0, 30)) {
    criteria[g.slug] = GENRE_HINTS[g.slug] ?? `${g.name} music`;
  }
  try {
    const result = await evaluate({
      model: "typesafe-ai/jev-latest",
      state: `A listener describes their current mood as: "${mood.slice(0, 500)}"`,
      questions: {
        primary: {
          type: "choice",
          instructions:
            "Which genre from the catalog best matches the listener's mood?",
          criteria,
        },
        secondary: {
          type: "choice",
          instructions:
            "If the mood clearly blends two genres, pick the second-best match; otherwise repeat the best match.",
          criteria,
        },
        energy: {
          type: "score",
          instructions: "How high-energy does the listener's mood sound?",
          criteria: ["Very calm and mellow", "Moderate", "High energy"],
        },
        instrumental: {
          type: "boolean",
          instructions:
            "Does the listener want instrumental music without vocals (studying, focus, sleep)?",
        },
      },
    });
    const primary = result.answers.primary;
    const secondary = result.answers.secondary;
    const energy = result.answers.energy;
    const instrumental = result.answers.instrumental;

    const bySlug = new Map(genres.map((g) => [g.slug, g]));
    const primaryGenre = bySlug.get(primary.choice) ?? genres[0]!;
    // Secondary counts only on real split confidence: it must clear an
    // absolute bar AND sit close to the primary. Otherwise a "dance" mood
    // drags in a low-confidence second genre and its whole shelf with it.
    let secondaryGenre: Genre | null = null;
    if (secondary.choice !== primary.choice) {
      const sProbs = secondary.probabilities;
      const pProbs = primary.probabilities;
      const sTop = sProbs ? (sProbs[secondary.choice] ?? 0) : 0;
      const pTop = pProbs ? (pProbs[primary.choice] ?? 1) : 1;
      if (sProbs && sTop >= 0.4 && pTop - sTop <= 0.25) {
        secondaryGenre = bySlug.get(secondary.choice) ?? null;
      }
    }
    const levelCount = 3;
    const energyNorm = Math.min(
      1,
      Math.max(0, energy.score / (levelCount - 1)),
    );
    return {
      primaryGenreId: primaryGenre.id,
      primaryGenreSlug: primaryGenre.slug,
      secondaryGenreId: secondaryGenre?.id ?? null,
      secondaryGenreSlug: secondaryGenre?.slug ?? null,
      energy: energyNorm,
      instrumentalPref: instrumental.probability >= 0.6,
      source: "jev",
    };
  } catch {
    return keywordVerdict(mood, genres);
  }
}

/**
 * Title-level mood gate. Genre matching alone lets a "dance" prompt surface
 * a song called "Suicide Season" — so filter on the one signal we have:
 *
 * - Self-harm titles are ALWAYS excluded from automated mixes (safety).
 * - High-energy moods (>0.6) additionally drop grief-coded titles.
 * - Low-energy moods (<0.35) additionally drop party-coded titles.
 *
 * Keyword lists are deliberately tight + word-boundaried to avoid false
 * positives ("Crystal" is not "cry"). This is a quality gate, not
 * censorship: search/explore still surface everything.
 */
const SELF_HARM_TITLES = [
  /suicid/i,
  /self[\s-]?harm/i,
  /kill\s+(myself|me)\b/i,
  /cut\s+my\s+(wrists?|self)\b/i,
  /hang\s+myself\b/i,
  /end\s+my\s+life\b/i,
  /want\s+to\s+die\b/i,
];

const SAD_TITLES = [
  /\bcry(ing)?\b/i,
  /\btears?\b/i,
  /\blonely\b/i,
  /\bgoodbye\b/i,
  /\bfarewell\b/i,
  /\bsad\b/i,
  /\bbroken\b/i,
  /\bheartbreak\b/i,
  /\bdepress\w*/i,
  /\bmiss\s+you\b/i,
  /\bwithout\s+you\b/i,
];

const PARTY_TITLES = [
  /\bparty\b/i,
  /\bdance\b/i,
  /\bdancing\b/i,
  /\bclub\b/i,
  /\bcelebrat\w*/i,
  /\bfiesta\b/i,
];

export function fitsMood(title: string, energy: number): boolean {
  if (SELF_HARM_TITLES.some((re) => re.test(title))) return false;
  if (energy > 0.6 && SAD_TITLES.some((re) => re.test(title))) return false;
  if (energy < 0.35 && PARTY_TITLES.some((re) => re.test(title))) return false;
  return true;
}

/**
 * Light weighting for variety: favor less-played + recently-added tracks.
 * play_count dominates, recency breaks ties — jittered explicitly rather
 * than shuffled, so fresh and underplayed tracks surface without chaos.
 */
export function weightedShuffle<T extends { playCount: number; createdAt: string }>(
  items: T[],
): T[] {
  const now = Date.now();
  return items
    .map((item) => {
      const ageDays = Math.max(
        0,
        (now - new Date(item.createdAt).getTime()) / 86_400_000,
      );
      const recencyBonus = Math.max(0, 30 - ageDays) / 30; // 0..1
      const popularityPenalty = Math.log10(item.playCount + 1) / 4; // ~0..1+
      const score = Math.random() * 2 + recencyBonus - popularityPenalty;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}
