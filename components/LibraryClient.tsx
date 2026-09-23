"use client";

import { useEffect, useState } from "react";
import type { Track } from "@/lib/db-types";
import { getSessionId } from "@/lib/session";
import { SongRow } from "@/components/SongCard";
import { PlayAllButton } from "@/components/PlayControls";
import { SongRowsSkeleton } from "@/components/Skeletons";

/** Full Library page: liked songs + recently played, session-keyed. */
export default function LibraryClient() {
  const [liked, setLiked] = useState<Track[] | null>(null);
  const [history, setHistory] = useState<Track[] | null>(null);

  useEffect(() => {
    const sessionId = getSessionId();
    fetch(`/api/likes?sessionId=${encodeURIComponent(sessionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (j) => {
        if (j?.songIds?.length) {
          const t = await fetch(`/api/tracks?ids=${encodeURIComponent(j.songIds.join(","))}`).then((r) =>
            r.ok ? r.json() : null,
          );
          setLiked(t?.tracks ?? []);
        } else setLiked([]);
      })
      .catch(() => setLiked([]));
    fetch(`/api/history?sessionId=${encodeURIComponent(sessionId)}&limit=30`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setHistory(j?.tracks ?? []))
      .catch(() => setHistory([]));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <h1 className="text-2xl font-black">Your library</h1>
      <p className="-mt-6 text-sm text-muted">
        Saved on this device only — no account needed.
      </p>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Liked songs</h2>
          {liked && liked.length > 0 && <PlayAllButton tracks={liked} label="Play" />}
        </div>
        {liked === null ? (
          <SongRowsSkeleton count={5} />
        ) : liked.length === 0 ? (
          <p className="rounded-xl border border-line bg-coal p-6 text-sm text-muted">
            Tap the heart on any track to build this shelf.
          </p>
        ) : (
          <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal px-2">
            {liked.map((t, i) => (
              <SongRow key={t.id} track={t} tracks={liked} index={i} />
            ))}
          </div>
        )}
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Recently played</h2>
          {history && history.length > 0 && <PlayAllButton tracks={history} label="Play" />}
        </div>
        {history === null ? (
          <SongRowsSkeleton count={5} />
        ) : history.length === 0 ? (
          <p className="rounded-xl border border-line bg-coal p-6 text-sm text-muted">
            Nothing played on this device yet.
          </p>
        ) : (
          <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal px-2">
            {history.map((t, i) => (
              <SongRow key={t.id} track={t} tracks={history} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
