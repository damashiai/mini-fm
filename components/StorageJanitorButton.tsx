"use client";

import { useState } from "react";

/**
 * One-click cleanup of orphaned storage objects (failed/interrupted uploads).
 * Only deletes files nothing references AND older than 24h — in-flight batch
 * items and catalog files are never touched.
 */
export default function StorageJanitorButton() {
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    if (
      !confirm(
        "Delete unreferenced audio + cover files older than 24h? Songs in the catalog are never touched.",
      )
    ) {
      return;
    }
    setState("working");
    setResult(null);
    try {
      const res = await fetch("/api/admin/storage-janitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanHours: 24 }),
      });
      const j = (await res.json()) as {
        error?: string;
        audio?: { checked: number; deleted: number; skipped: number };
        images?: { checked: number; deleted: number; skipped: number };
      };
      setState("done");
      setResult(
        res.ok && j.audio && j.images
          ? `Checked ${j.audio.checked} audio + ${j.images.checked} covers — removed ${j.audio.deleted} orphaned audio, ${j.images.deleted} orphaned covers.`
          : (j.error ?? "cleanup failed"),
      );
    } catch {
      setState("done");
      setResult("cleanup failed");
    }
  };

  return (
    <div className="rounded-xl border border-line bg-coal p-4">
      <p className="font-semibold">Storage cleanup</p>
      <p className="mt-1 text-xs text-muted">
        Removes uploaded files nothing references (failed or abandoned uploads).
      </p>
      <button
        onClick={run}
        disabled={state === "working"}
        className="mt-3 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-card disabled:opacity-50"
      >
        {state === "working" ? "Scanning…" : "Clean orphaned files"}
      </button>
      {result && <p className="mt-2 text-xs text-muted">{result}</p>}
    </div>
  );
}
