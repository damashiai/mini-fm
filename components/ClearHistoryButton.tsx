"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

/** Danger-zone: wipe the plays table and reset songs.play_count to zero. */
export default function ClearHistoryButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    if (
      !confirm(
        "Delete ALL play history? Charts reset to zero. Likes and songs are untouched. This cannot be undone.",
      )
    ) {
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/plays", { method: "DELETE" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setResult(res.ok ? "Play history cleared — charts start from zero." : (j.error ?? "failed"));
    } catch {
      setResult("failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-red-900/60 bg-coal p-4">
      <p className="font-semibold">Play history</p>
      <p className="mt-1 text-xs text-muted">
        Wipes every play record and zeroes play counts. Likes stay.
      </p>
      <button
        onClick={run}
        disabled={busy}
        className="mt-3 flex items-center gap-2 rounded-lg border border-red-900 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950 disabled:opacity-50"
      >
        <Trash2 size={15} /> {busy ? "Clearing…" : "Clear all plays"}
      </button>
      {result && <p className="mt-2 text-xs text-muted">{result}</p>}
    </div>
  );
}
