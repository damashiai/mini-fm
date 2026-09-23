"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ArtistEditForm({
  artistId,
  initial,
}: {
  artistId: string;
  initial: { name: string; bio: string; imageUrl: string };
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
    const res = await fetch(`/api/admin/artists/${artistId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: s.name,
        bio: s.bio || null,
        image_url: s.imageUrl || null,
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
    if (!confirm("Delete this artist? Blocked while any song still credits them.")) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/artists/${artistId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) router.push("/admin/artists");
    else {
      const j = await res.json().catch(() => ({}));
      setMsg((j as { error?: string }).error ?? "Delete failed");
    }
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs uppercase tracking-wide text-muted">Name</span>
        <input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} className={inputCls} />
      </label>
      <label className="block">
        <span className="text-xs uppercase tracking-wide text-muted">Bio</span>
        <textarea value={s.bio} onChange={(e) => setS({ ...s, bio: e.target.value })} rows={4} className={inputCls} />
      </label>
      <label className="block">
        <span className="text-xs uppercase tracking-wide text-muted">Image URL</span>
        <input value={s.imageUrl} onChange={(e) => setS({ ...s, imageUrl: e.target.value })} className={inputCls} />
      </label>
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
