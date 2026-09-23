"use client";

import { useEffect, useState } from "react";
import type { Track } from "@/lib/db-types";
import { getSessionId } from "@/lib/session";
import Link from "next/link";
import { SongRow } from "./SongCard";
import { SongRowsSkeleton } from "./Skeletons";

/**
 * Personal shelves without accounts: liked songs + recently played, keyed by
 * the localStorage session id. Rendered client-side (session id is local).
 */
export default function HomeShelves() {
  const [liked, setLiked] = useState<Track[] | null>(null);
  const [history, setHistory] = useState<Track[] | null>(null);

  useEffect(() => {
    const sessionId = getSessionId();
    fetch(`/api/likes?sessionId=${encodeURIComponent(sessionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (j) => {
        if (j?.songIds?.length) {
          const t = await fetch(
            `/api/tracks?ids=${encodeURIComponent(j.songIds.slice(0, 5).join(","))}`,
          ).then((r) => (r.ok ? r.json() : null));
          setLiked(t?.tracks ?? []);
        } else {
          setLiked([]);
        }
      })
      .catch(() => setLiked([]));
    fetch(`/api/history?sessionId=${encodeURIComponent(sessionId)}&limit=5`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setHistory(j?.tracks ?? []))
      .catch(() => setHistory([]));
  }, []);

  // Session fetch pending → compact skeletons (avoids a layout pop later).
  if (liked === null || history === null) {
    return (
      <section aria-label="Loading your shelves">
        <div className="mb-3 h-7 w-44">
          <span className="skeleton block h-full w-full rounded-md" />
        </div>
        <SongRowsSkeleton count={3} />
      </section>
    );
  }

  if (liked.length === 0 && history.length === 0) return null;

  return (
    <>
      {liked.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-xl font-extrabold">Your liked songs</h2>
            <Link href="/library" className="text-sm text-muted hover:text-white">
              Library →
            </Link>
          </div>
          <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal px-2">
            {liked.map((t, i) => (
              <SongRow key={t.id} track={t} tracks={liked} index={i} />
            ))}
          </div>
        </section>
      )}
      {history.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-xl font-extrabold">Recently played</h2>
            <Link href="/library" className="text-sm text-muted hover:text-white">
              Library →
            </Link>
          </div>
          <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal px-2">
            {history.map((t, i) => (
              <SongRow key={t.id} track={t} tracks={history} index={i} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
