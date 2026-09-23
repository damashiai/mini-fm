"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AlbumEditForm({
  albumId,
  initial,
}: {
  albumId: string;
  initial: {
    title: string;
    coverArtUrl: string;
    releaseDate: string;
    albumType: "album" | "single" | "ep";
  };
}) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const inputCls =
    "mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-brand";

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/albums/${albumId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: s.title,
        cover_art_url: s.coverArtUrl || null,
        release_date: s.releaseDate || null,
        album_type: s.albumType,
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

  const remove = async () => {
    if (!confirm("Delete this release? Its tracks become loose singles (kept).")) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/albums/${albumId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) router.push("/admin/albums");
    else setMsg("Delete failed");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-muted">Title</span>
          <input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-muted">Type</span>
          <select
            value={s.albumType}
            onChange={(e) => setS({ ...s, albumType: e.target.value as "album" | "single" | "ep" })}
            className={inputCls}
          >
            <option value="album">Album</option>
            <option value="single">Single</option>
            <option value="ep">EP</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-muted">Release date</span>
          <input type="date" value={s.releaseDate} onChange={(e) => setS({ ...s, releaseDate: e.target.value })} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-muted">Cover art URL</span>
          <input value={s.coverArtUrl} onChange={(e) => setS({ ...s, coverArtUrl: e.target.value })} className={inputCls} />
        </label>
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="rounded-lg bg-brand px-5 py-2 text-sm font-bold hover:bg-brandDark disabled:opacity-50">
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button onClick={remove} disabled={deleting} className="ml-auto rounded-lg border border-red-900 px-5 py-2 text-sm text-red-400 hover:bg-red-950 disabled:opacity-50">
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
