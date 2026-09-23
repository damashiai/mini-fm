"use client";

import Link from "next/link";
import { Music2, Play, Plus } from "lucide-react";
import type { Track } from "@/lib/db-types";
import { formatTime } from "@/lib/utils";
import { usePlayer } from "./player-store";
import LikeButton from "./LikeButton";
import CoverImage from "./CoverImage";

function Cover({ track, size }: { track: Track; size: string }) {
  if (track.coverArt) {
    return <CoverImage src={track.coverArt} alt={track.title} className={`${size} rounded-lg`} />;
  }
  return (
    <div className={`${size} grid place-items-center rounded-lg bg-card text-muted`}>
      <Music2 size={28} />
    </div>
  );
}

/** Netflix-style poster card with play + add-to-queue on any song card. */
export default function SongCard({ track }: { track: Track }) {
  const playTracks = usePlayer((s) => s.playTracks);
  const addToQueue = usePlayer((s) => s.addToQueue);
  const current = usePlayer((s) => s.current());

  return (
    <div
      className={`group relative overflow-hidden rounded-xl bg-card transition hover:bg-line/60 ${
        current?.id === track.id ? "ring-1 ring-brand" : ""
      }`}
    >
      <button
        className="relative block w-full text-left"
        onClick={() => playTracks([track])}
        aria-label={`Play ${track.title}`}
      >
        <Cover track={track} size="aspect-square w-full" />
        <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand text-white">
            <Play size={22} fill="currentColor" className="ml-0.5" />
          </span>
        </span>
      </button>
      <div className="p-3">
        <Link href={`/song/${track.id}`} className="block truncate text-sm font-semibold hover:underline">
          {track.title}
        </Link>
        <div className="truncate text-xs text-muted">{track.artistNames}</div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] tabular-nums text-muted">{formatTime(track.duration)}</span>
          <span className="flex items-center gap-1">
            <LikeButton songId={track.id} small />
            <button
              onClick={() => addToQueue(track)}
              title="Add to queue"
              aria-label={`Add ${track.title} to queue`}
              className="rounded-md p-1 text-muted hover:bg-line hover:text-white"
            >
              <Plus size={16} />
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

export function SongGrid({ tracks }: { tracks: Track[] }) {
  if (tracks.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-coal p-10 text-center">
        <p className="text-lg font-semibold">Nothing here yet</p>
        <p className="mt-1 text-sm text-muted">
          Tracks will appear once the admin uploads them.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {tracks.map((t) => (
        <SongCard key={t.id} track={t} />
      ))}
    </div>
  );
}

/** Compact row used on detail pages, charts, queue, shelves. */
export function SongRow({
  track,
  tracks,
  index,
  rank,
}: {
  track: Track;
  tracks?: Track[];
  index?: number;
  rank?: number;
}) {
  const playTracks = usePlayer((s) => s.playTracks);
  const addToQueue = usePlayer((s) => s.addToQueue);
  const playAt = usePlayer((s) => s.playAt);
  const queue = usePlayer((s) => s.queue);

  const onPlay = () => {
    if (tracks && index != null) playTracks(tracks, index);
    else playTracks([track]);
  };

  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-card">
      {rank != null && (
        <span className="w-7 text-center text-lg font-black text-muted">{rank}</span>
      )}
      <button onClick={onPlay} className="relative shrink-0" aria-label={`Play ${track.title}`}>
        <Cover track={track} size="h-11 w-11" />
      </button>
      <button onClick={onPlay} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium">{track.title}</span>
        <span className="block truncate text-xs text-muted">{track.artistNames}</span>
      </button>
      <span className="hidden text-[11px] tabular-nums text-muted sm:block">
        {track.playCount} plays
      </span>
      <span className="text-[11px] tabular-nums text-muted">{formatTime(track.duration)}</span>
      <LikeButton songId={track.id} small />
      <button
        onClick={() => {
          const qi = queue.findIndex((q) => q.id === track.id);
          if (qi >= 0) playAt(qi);
          else addToQueue(track);
        }}
        className="rounded-md p-1.5 text-muted opacity-100 hover:bg-line hover:text-white md:opacity-0 md:group-hover:opacity-100"
        title="Play / queue"
        aria-label={`Play ${track.title}`}
      >
        <Play size={13} fill="currentColor" />
      </button>
      <button
        onClick={() => addToQueue(track)}
        className="rounded-md p-1.5 text-muted opacity-100 hover:bg-line hover:text-white md:opacity-0 md:group-hover:opacity-100"
        title="Add to queue"
        aria-label={`Add ${track.title} to queue`}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
