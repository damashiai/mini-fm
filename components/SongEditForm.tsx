"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

interface EditState {
  title: string;
  releaseDate: string;
  languageCode: string;
  isInstrumental: boolean;
  coverArtUrl: string;
  plainLyrics: string;
  syncedLyrics: string;
  genreIds: string[];
  artistIds: string[];
  albumId: string;
  durationSeconds: number | null;
}

export default function SongEditForm({
  songId,
  initial,
  allGenres,
  allLanguages,
  allArtists,
  allAlbums,
}: {
  songId: string;
  initial: EditState;
  allGenres: { id: string; name: string }[];
  allLanguages: { code: string; name: string }[];
  allArtists: { id: string; name: string }[];
  allAlbums: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lyrBusy, setLyrBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (p: Partial<EditState>) => setS((prev) => ({ ...prev, ...p }));

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/songs/${songId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: s.title,
        releaseDate: s.releaseDate || null,
        languageCode: s.languageCode || null,
        isInstrumental: s.isInstrumental,
        coverArtUrl: s.coverArtUrl || null,
        plainLyrics: s.plainLyrics || null,
        syncedLyrics: s.syncedLyrics || null,
        genreIds: s.genreIds,
        artistIds: s.artistIds,
        albumId: s.albumId || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Saved ✓");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg((j as { error?: string }).error ?? "Save failed");
    }
  };

  /** Pull lrclib lyrics into the DB row (synced preferred, instrumental flagged). */
  const fetchLyrics = async () => {
    const artistName = allArtists.find((a) => a.id === s.artistIds[0])?.name ?? "";
    if (!s.title.trim() || !artistName) {
      setMsg("Title + at least one artist are needed for lyrics lookup.");
      return;
    }
    setLyrBusy(true);
    try {
      const res = await fetch("/api/admin/lyrics-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Duration disambiguates versions (studio vs live vs remix) — without
        // it lrclib can return correctly-worded but wrongly-timed synced lyrics.
        body: JSON.stringify({
          track: s.title.trim(),
          artist: artistName,
          durationSeconds: s.durationSeconds ?? undefined,
        }),
      });
      const ly = (await res.json()) as {
        status?: string;
        plainLyrics?: string | null;
        syncedLyrics?: string | null;
      };
      if (!res.ok) throw new Error("lookup failed");
      const patchBody = {
        plainLyrics: ly.plainLyrics || null,
        syncedLyrics: ly.syncedLyrics || null,
        lyricsSource: ly.status && ly.status !== "not-found" ? "lrclib" : null,
        isInstrumental: ly.status === "instrumental",
      };
      const save = await fetch(`/api/admin/songs/${songId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      if (!save.ok) throw new Error("could not save lyrics");
      set({
        plainLyrics: ly.plainLyrics ?? "",
        syncedLyrics: ly.syncedLyrics ?? "",
        isInstrumental: ly.status === "instrumental" ? true : s.isInstrumental,
      });
      setMsg(
        ly.status === "synced"
          ? "Synced lyrics saved ✓"
          : ly.status === "instrumental"
            ? "Marked as instrumental ✓"
            : ly.status === "plain"
              ? "Plain lyrics saved ✓"
              : "No match on lrclib — nothing saved.",
      );
      router.refresh();
    } catch {
      setMsg("Lyrics lookup failed.");
    } finally {
      setLyrBusy(false);
    }
  };

  const remove = async () => {    if (!confirm("Delete this track permanently (audio + metadata)?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/songs/${songId}`, { method: "DELETE" });
      if (res.ok) router.push("/admin");
      else setMsg("Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const inputCls =
    "mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-muted">Title</span>
          <input value={s.title} onChange={(e) => set({ title: e.target.value })} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-muted">Release date</span>
          <input type="date" value={s.releaseDate} onChange={(e) => set({ releaseDate: e.target.value })} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-muted">Language</span>
          <select value={s.languageCode} onChange={(e) => set({ languageCode: e.target.value })} className={inputCls}>
            <option value="">—</option>
            {allLanguages.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-muted">Cover art URL</span>
          <input value={s.coverArtUrl} onChange={(e) => set({ coverArtUrl: e.target.value })} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-muted">Album</span>
          <select value={s.albumId} onChange={(e) => set({ albumId: e.target.value })} className={inputCls}>
            <option value="">No album (single)</option>
            {allAlbums.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.isInstrumental} onChange={(e) => set({ isInstrumental: e.target.checked })} />
          Instrumental track
        </label>
      </div>

      <div>
        <span className="text-xs uppercase tracking-wide text-muted">Artists</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {allArtists.map((a) => (
            <button
              key={a.id}
              onClick={() => set({ artistIds: toggle(s.artistIds, a.id) })}
              className={`rounded-full px-3 py-1 text-xs ${s.artistIds.includes(a.id) ? "bg-brand font-bold" : "bg-card text-muted hover:text-white"}`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs uppercase tracking-wide text-muted">Genres</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {allGenres.map((g) => (
            <button
              key={g.id}
              onClick={() => set({ genreIds: toggle(s.genreIds, g.id) })}
              className={`rounded-full px-3 py-1 text-xs ${s.genreIds.includes(g.id) ? "bg-brand font-bold" : "bg-card text-muted hover:text-white"}`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted">
            Lyrics{" "}
            {s.durationSeconds ? (
              <span className="ml-1 rounded bg-card px-1.5 py-0.5 normal-case text-muted">
                {Math.floor(s.durationSeconds / 60)}:{String(Math.floor(s.durationSeconds % 60)).padStart(2, "0")} ·
                sent to lrclib for version matching
              </span>
            ) : (
              <span className="ml-1 rounded bg-red-950 px-1.5 py-0.5 normal-case text-red-300">
                no duration saved — matches may mistime
              </span>
            )}
          </span>
          <button
            onClick={fetchLyrics}
            disabled={lyrBusy}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-card disabled:opacity-50"
          >
            {lyrBusy ? "Looking up…" : "Fetch from lrclib"}
          </button>
        </div>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-muted">Synced lyrics (LRC)</span>
          <textarea value={s.syncedLyrics} onChange={(e) => set({ syncedLyrics: e.target.value })} rows={6} className={`${inputCls} font-mono`} />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-muted">Plain lyrics</span>
          <textarea value={s.plainLyrics} onChange={(e) => set({ plainLyrics: e.target.value })} rows={6} className={inputCls} />
        </label>
      </div>

      {msg && <p className="text-sm text-muted">{msg}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="rounded-lg bg-brand px-5 py-2 text-sm font-bold hover:bg-brandDark disabled:opacity-50">
          {busy ? "Saving…" : "Save changes"}
        </button>
        <Link href={`/song/${songId}`} className="rounded-lg border border-line px-5 py-2 text-sm hover:bg-card">
          View page
        </Link>
        <button onClick={remove} disabled={deleting} className="ml-auto rounded-lg border border-red-900 px-5 py-2 text-sm text-red-400 hover:bg-red-950 disabled:opacity-50">
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
