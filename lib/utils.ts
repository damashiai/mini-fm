export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function slugify(input: string): string {
  // Unicode-aware: Japanese/Korean/Hindi titles keep their characters
  // (Next.js URL-encodes them fine). Old [a-z0-9]-only version turned every
  // non-Latin title into "untitled", "untitled-1", …
  const cleaned = input
    .toLowerCase()
    // NFC keeps Hangul syllables composed. Combining marks are stripped ONLY
    // after ASCII letters (é→e) — stripping them globally would eat Indic
    // vowel signs (चाँदनी→चदन), Thai, Arabic diacritics, etc.
    .normalize("NFC")
    .replace(/([a-z])\p{M}+/gu, "$1")
    // Keep letters, numbers AND combining marks (Indic/Thai/Arabic vowel
    // signs are marks — dropping them mangles the words).
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "untitled";
}

export function shortId(length = 8): string {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function formatTime(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "0:00";
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}

export function decadeOf(releaseDate: string | null | undefined): string | null {
  if (!releaseDate) return null;
  const year = Number(releaseDate.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  return `${Math.floor(year / 10) * 10}s`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
