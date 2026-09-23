/**
 * Templated playlist title/blurb from the matched genre + energy.
 * Deliberately NOT an LLM call — the whole point of using Jev (a decision
 * model) for mood mapping is keeping this pipeline cheap and fast.
 *
 * Titles never parrot the user's prompt back at them; the prompt lives in
 * the blurb (as the receipt of what was matched), while the title reads
 * like a real mix name, picked by energy bucket.
 */

const HIGH_TITLES = [
  "High-voltage {Genre}",
  "{Genre}, turned all the way up",
  "Peak-time {Genre}",
  "{Genre} at full blast",
];

const MID_TITLES = [
  "{Genre} on repeat",
  "A {Genre} steady flow",
  "{Genre}, front to back",
  "Pure {Genre}",
];

const LOW_TITLES = [
  "{Genre} after hours",
  "Low-light {Genre}",
  "{Genre} in slow motion",
  "Late-night {Genre}",
];

function hashPick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return arr[h % arr.length]!;
}

export function buildPlaylistTitle(opts: {
  moodPrompt: string;
  primaryGenre: string;
  secondaryGenre?: string | null;
  energy?: number;
  trackCount?: number;
  totalSeconds?: number;
}): { title: string; blurb: string } {
  const energy = opts.energy ?? 0.5;
  const pool = energy > 0.62 ? HIGH_TITLES : energy < 0.38 ? LOW_TITLES : MID_TITLES;
  const title = hashPick(pool, opts.moodPrompt + opts.primaryGenre).replace(
    "{Genre}",
    opts.primaryGenre,
  );
  const secondary = opts.secondaryGenre ? ` with ${opts.secondaryGenre}` : "";
  const prompt = opts.moodPrompt.trim().slice(0, 120);
  let stats = "";
  if (opts.trackCount) {
    const mins = opts.totalSeconds ? Math.round(opts.totalSeconds / 60) : 0;
    stats = ` ${opts.trackCount} tracks${mins ? ` · ${mins} min` : ""} — save it and the mix lives 7 days.`;
  }
  const blurb =
    `Matched to “${prompt}”: ${opts.primaryGenre.toLowerCase()}${secondary.toLowerCase()}, ` +
    `leaning fresh and less-played.${stats}`;
  return { title, blurb };
}
