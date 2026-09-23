"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { getSessionId } from "@/lib/session";
import { fetchLikedIds, likedSnapshot, markLikedLocal } from "@/lib/likes-cache";
import { cn } from "@/lib/utils";

/**
 * Anonymous like toggle, keyed by the localStorage session id. Reads from a
 * shared cache (one /api/likes request per minute no matter how many cards
 * mount) and shows the stale value while a refresh loads.
 */
export default function LikeButton({
  songId,
  small = false,
}: {
  songId: string;
  small?: boolean;
}) {
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    const snap = likedSnapshot();
    if (snap) setLiked(snap.has(songId));
    fetchLikedIds().then((ids) => {
      if (live) setLiked(ids.has(songId));
    });
    return () => {
      live = false;
    };
  }, [songId]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !liked;
    setLiked(next); // optimistic
    markLikedLocal(songId, next);
    try {
      await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, sessionId: getSessionId(), liked: next }),
      });
    } catch {
      setLiked(!next);
      markLikedLocal(songId, !next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={liked ? "Unlike" : "Like"}
      title={liked ? "Unlike" : "Like"}
      className={cn(
        "rounded-md p-1 transition hover:scale-110",
        liked ? "text-brand" : "text-muted hover:text-white",
      )}
    >
      <Heart size={small ? 17 : 22} fill={liked ? "currentColor" : "none"} />
    </button>
  );
}
