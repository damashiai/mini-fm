"use client";

import { useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import type { Track } from "@/lib/db-types";
import { usePlayer } from "./player-store";
import { getSessionId } from "@/lib/session";
import { SongRow } from "./SongCard";
import { SongRowsSkeleton } from "./Skeletons";

interface MoodResult {
  prompt: string;
  title: string;
  blurb: string;
  verdict: {
    primaryGenre: string;
    secondaryGenre: string | null;
    source: string;
  };
  matchedGenreIds: string[];
  matchedGenres: { slug: string; name: string }[];
  confidence: "high" | "low";
  tracks: Track[];
  songIds: string[];
}

function runtime(tracks: Track[]): string {
  const secs = tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0);
  if (!secs) return "preview";
  const mins = Math.round(secs / 60);
  return mins >= 60
    ? `${Math.floor(mins / 60)}h ${mins % 60}m`
    : `${mins} min`;
}

export default function MoodForm() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MoodResult | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const playTracks = usePlayer((s) => s.playTracks);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim().length < 2 || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSavedUrl(null);
    try {
      const res = await fetch("/api/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), sessionId: getSessionId() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Mood matching failed");
      setResult(json as MoodResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!result || saving) return;    setSaving(true);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moodPrompt: result.prompt,
          matchedGenreIds: result.matchedGenreIds,
          songIds: result.songIds,
        }),
      });
      const json = await res.json();
      if (res.ok) setSavedUrl(json.url);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-coal via-coal to-[#2a0d10] p-6 sm:p-8">
      <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
        What&apos;s the <span className="text-brand">mood</span>?
      </h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Describe how you feel in plain words — we&apos;ll map it to genres and
        build a ~12-track mix. Nothing is saved unless you choose to share it.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. rainy Sunday morning, chai in hand, nowhere to be…"
          maxLength={500}
          className="flex-1 rounded-xl border border-line bg-ink px-4 py-3 text-sm outline-none placeholder:text-muted/70 focus:border-brand"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-brand px-6 py-3 text-sm font-bold hover:bg-brandDark disabled:opacity-50"
        >
          {loading ? "Reading the room…" : "Make my mix"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-brand">{error}</p>}

      {loading && (
        <div className="animate-rise mt-6 rounded-xl border border-line bg-ink/60 p-4" aria-label="Generating mix">
          <div className="space-y-2">
            <span className="skeleton block h-6 w-1/3 rounded-md" />
            <span className="skeleton block h-4 w-2/3 rounded-md" />
          </div>
          <div className="mt-3">
            <SongRowsSkeleton count={6} />
          </div>
        </div>
      )}

      {result && (
        <div className="animate-rise mt-6 rounded-xl border border-line bg-ink/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-1.5">
                {(result.matchedGenres ?? []).map((g) => (
                  <Link
                    key={g.slug}
                    href={`/genre/${g.slug}`}
                    className="rounded-full bg-brand/15 px-3 py-0.5 text-xs font-semibold text-brand hover:bg-brand/25"
                  >
                    {g.name}
                  </Link>
                ))}
                <span className="rounded-full bg-card px-3 py-0.5 text-xs text-muted">
                  {result.tracks.length} tracks · {runtime(result.tracks)}
                </span>
              </div>
              <h2 className="mt-2 text-xl font-black tracking-tight">{result.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">{result.blurb}</p>
              {result.confidence === "low" && (
                <p className="mt-2 text-xs text-amber-300/90">
                  Small shelf — only {result.tracks.length} close{" "}
                  {result.tracks.length === 1 ? "match" : "matches"} in the catalog
                  right now. Grows as more music lands.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => playTracks(result.tracks)}
                className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-black hover:scale-[1.02]"
              >
                <Play size={15} fill="currentColor" /> Play
              </button>
              {savedUrl ? (
                <Link
                  href={savedUrl}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-bold hover:bg-brandDark"
                >
                  Open share link
                </Link>
              ) : (
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-card disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save / Share"}
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 divide-y divide-line/60">
            {result.tracks.map((t, i) => (
              <SongRow key={t.id} track={t} tracks={result.tracks} index={i} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
