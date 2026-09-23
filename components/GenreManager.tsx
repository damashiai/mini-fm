"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

interface GenreRow {
  id: string;
  name: string;
  slug: string;
  songCount: number;
}

/** Inline genre manager: rename, delete (unlinks songs), create. */
export default function GenreManager({ initial }: { initial: GenreRow[] }) {
  const [genres, setGenres] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const rename = async (id: string) => {
    if (!draft.trim()) {
      setEditing(null);
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/genres/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      setGenres((g) => g.map((x) => (x.id === id ? { ...x, name: draft.trim() } : x)));
      setEditing(null);
    }
  };

  const remove = async (g: GenreRow) => {
    if (
      !confirm(
        `Delete genre “${g.name}”? It will be unlinked from ${g.songCount} song(s) (songs are kept).`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/genres/${g.id}`, { method: "DELETE" });
    if (res.ok) setGenres((list) => list.filter((x) => x.id !== g.id));
  };

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/genres", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const j = (await res.json().catch(() => null)) as { genre?: GenreRow; error?: string } | null;
    setBusy(false);
    if (res.ok && j?.genre) {
      setGenres((list) => [...list, j.genre!].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setCreating(false);
    } else {
      alert(j?.error ?? "Create failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal">
        {genres.map((g) => (
          <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
            {editing === g.id ? (
              <>
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void rename(g.id);
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-brand bg-ink px-2 py-1 text-sm outline-none"
                />
                <button onClick={() => void rename(g.id)} disabled={busy} aria-label="Save" className="rounded p-1 text-green-400 hover:bg-line">
                  <Check size={16} />
                </button>
                <button onClick={() => setEditing(null)} aria-label="Cancel" className="rounded p-1 text-muted hover:text-white">
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{g.name}</p>
                  <p className="text-xs text-muted">
                    /{g.slug} · {g.songCount} song{g.songCount === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditing(g.id);
                    setDraft(g.name);
                  }}
                  aria-label={`Rename ${g.name}`}
                  className="rounded p-1.5 text-muted hover:bg-line hover:text-white"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => void remove(g)}
                  aria-label={`Delete ${g.name}`}
                  className="rounded p-1.5 text-muted hover:bg-red-950 hover:text-red-300"
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        ))}
        {genres.length === 0 && <p className="p-6 text-sm text-muted">No genres yet.</p>}
      </div>

      {creating ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder="Genre name (e.g. City Pop)"
            className="min-w-0 flex-1 rounded-lg border border-line bg-coal px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button onClick={() => void create()} disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm font-bold hover:bg-brandDark disabled:opacity-50">
            Add
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-card"
        >
          <Plus size={15} /> New genre
        </button>
      )}
    </div>
  );
}
