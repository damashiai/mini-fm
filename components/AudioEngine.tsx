"use client";

import { useEffect, useRef } from "react";
import { usePlayer } from "./player-store";

/**
 * Singleton <audio> manager. Handles:
 * - short-lived Supabase signed URLs (regenerated per track, refreshed when
 *   close to expiry — bytes stream straight from Supabase CDN, never proxied)
 * - MediaSession metadata + lock-screen / notification action handlers
 * - auto-continue: when the queue ends, appends similar tracks (same genre,
 *   excluding what's already played this session) instead of stopping
 */

/**
 * Slider position → element gain. Human loudness is logarithmic: a linear
 * mapping keeps everything above 50% feeling "loud". Squaring spreads the
 * perceptual range across the whole slider (50% ≈ quarter power).
 */
export function sliderToGain(v: number): number {
  const c = Math.min(1, Math.max(0, v));
  return c * c;
}
export default function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlCache = useRef(new Map<string, { url: string; expiresAt: number }>());
  const autoContinueTried = useRef<string | null>(null);
  // One-shot seek applied on the next loadedmetadata (used by ResumeState:
  // the signed URL isn't ready at restore time, so seeking must wait).
  const pendingSeek = useRef<number | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const unsub = usePlayer.subscribe((s, prev) => {
      const el = audioRef.current;
      if (!el) return;
      // NOTE: compare the queue/index SNAPSHOTS directly — never
      // s.current() vs prev.current(). `current()` closes over the live
      // get(), so both sides evaluate against the NEW state and a track
      // change is never detected (playback silently never starts).
      const cur = s.queue[s.index] ?? null;
      const prv = prev.queue[prev.index] ?? null;
      if ((cur?.queueKey ?? null) !== (prv?.queueKey ?? null)) {
        // loadTrack owns playback for new tracks — firing el.play() here
        // with no src yet rejects and flips isPlaying off mid-load.
        void loadTrack(el, cur?.id ?? null);
        return;
      }
      // Play/pause for the SAME track only.
      if (s.isPlaying !== prev.isPlaying) {
        if (s.isPlaying) void startPlayback(el);
        else el.pause();
      }
      if (s.volume !== prev.volume) el.volume = sliderToGain(s.volume);
      if (s.muted !== prev.muted) el.muted = s.muted;
    });

    const onTime = () => {
      const el = audioRef.current!;
      let buffered = 0;
      try {
        if (el.buffered.length > 0) {
          buffered = el.buffered.end(el.buffered.length - 1);
        }
      } catch {
        /* noop */
      }
      usePlayer.getState().setTime(el.currentTime, el.duration || 0, buffered);
    };
    const onEnded = () => {
      void handleEnded();
    };
    const onSeekRequest = (e: Event) => {
      const el = audioRef.current;
      if (el) el.currentTime = (e as CustomEvent<number>).detail ?? 0;
    };
    const onSeekAfterLoad = (e: Event) => {
      pendingSeek.current = (e as CustomEvent<number>).detail ?? 0;
    };
    const onLoadedMeta = () => {
      if (pendingSeek.current == null) return;
      const el = audioRef.current;
      const t = pendingSeek.current;
      pendingSeek.current = null;
      if (el && Number.isFinite(el.duration) && el.duration > 0) {
        try {
          el.currentTime = Math.min(Math.max(0, t), Math.max(0, el.duration - 0.5));
        } catch {
          /* will converge via timeupdate */
        }
        usePlayer.getState().setTime(el.currentTime || 0, el.duration || 0);
      }
    };
    // Buffering feedback for the play-button spinner + art pulse.
    const onWaiting = () => usePlayer.getState().setBuffering(true);
    const onPlaying = () => {
      const st = usePlayer.getState();
      st.setBuffering(false);
      st.setAudioError(null);
    };
    const onHalted = () => usePlayer.getState().setBuffering(false);
    // Hard failures (bad URL, deleted object, decode error): never leave the
    // UI spinning silently — surface it in the player bars.
    // NOTE: 'abort' is deliberately NOT fatal. Replacing src mid-load aborts
    // the superseded request, so an abort almost always belongs to a load we
    // already moved past — treating it as failure kills the NEW playback
    // (tap song, 206 flowing, bogus error, retry works: the classic symptom).
    const onLoadError = () => {
      const st = usePlayer.getState();
      st.setBuffering(false);
      st.setPlaying(false);
      st.setAudioError("This audio file couldn't be loaded. It may have been moved or deleted — try another track.");
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("progress", onTime);
    audio.addEventListener("loadedmetadata", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onHalted);
    audio.addEventListener("error", onLoadError);
    audio.addEventListener("loadedmetadata", onLoadedMeta);
    document.addEventListener("minifm:seek", onSeekRequest);
    document.addEventListener("minifm:seek-after-load", onSeekAfterLoad);

    // MediaSession action handlers (lock-screen / notification controls).
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.setActionHandler("play", () => usePlayer.getState().setPlaying(true));
        navigator.mediaSession.setActionHandler("pause", () => usePlayer.getState().setPlaying(false));
        navigator.mediaSession.setActionHandler("previoustrack", () => usePlayer.getState().prev());
        navigator.mediaSession.setActionHandler("nexttrack", () => usePlayer.getState().next());
        navigator.mediaSession.setActionHandler("seekto", (d) => {
          const el = audioRef.current;
          if (el && typeof d.seekTime === "number") el.currentTime = d.seekTime;
        });
        navigator.mediaSession.setActionHandler("seekbackward", (d) => {
          const el = audioRef.current;
          if (el) el.currentTime = Math.max(0, el.currentTime - (d.seekOffset ?? 10));
        });
        navigator.mediaSession.setActionHandler("seekforward", (d) => {
          const el = audioRef.current;
          if (el) el.currentTime += d.seekOffset ?? 10;
        });
      } catch {
        /* some browsers throw on unsupported actions */
      }
    }

    // Initial load if something is already queued.
    const first = usePlayer.getState().current();
    if (first) void loadTrack(audio, first.id);

    return () => {
      unsub();
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("progress", onTime);
      audio.removeEventListener("loadedmetadata", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onHalted);
      audio.removeEventListener("error", onLoadError);
      audio.removeEventListener("loadedmetadata", onLoadedMeta);
      document.removeEventListener("minifm:seek", onSeekRequest);
      document.removeEventListener("minifm:seek-after-load", onSeekAfterLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep MediaSession metadata in sync with the current track.
  const current = usePlayer((s) => s.current());
  useEffect(() => {
    if ("mediaSession" in navigator && current) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: current.title,
          artist: current.artistNames,
          album: current.album?.title ?? "",
          artwork: current.coverArt
            ? [{ src: current.coverArt, sizes: "512x512" }]
            : [],
        });
      } catch {
        /* noop */
      }
    }
  }, [current?.queueKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function signedUrl(songId: string): Promise<string> {
    const cached = urlCache.current.get(songId);
    // Refresh 5 min before expiry so seeking never hits a dead URL.
    if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
      return cached.url;
    }
    const res = await fetch(`/api/stream?song=${encodeURIComponent(songId)}`);
    if (!res.ok) throw new Error("stream unavailable");
    const json = (await res.json()) as { url: string; expiresAt: number };
    urlCache.current.set(songId, json);
    if (urlCache.current.size > 20) {
      const first = urlCache.current.keys().next().value;
      if (first) urlCache.current.delete(first);
    }
    return json.url;
  }

  async function loadTrack(el: HTMLAudioElement, songId: string | null) {
    const state = usePlayer.getState();
    if (!songId) {
      el.removeAttribute("src");
      el.load();
      return;
    }
    state.setAudioError(null);
    try {
      // Stop the current song immediately — it shouldn't keep playing under
      // the signed-URL fetch for the next one. (UI stays in playing state.)
      try {
        el.pause();
      } catch {
        /* element not yet readable */
      }
      state.setBuffering(true);
      el.src = await signedUrl(songId);
      el.volume = sliderToGain(state.volume);
      el.muted = state.muted;
      if (usePlayer.getState().isPlaying) {
        await startPlayback(el);
      } else {
        state.setBuffering(false);
      }
    } catch {
      // startPlayback already reported; a sign failure lands here.
      state.setBuffering(false);
      state.setPlaying(false);
      state.setAudioError("Couldn't get this track's stream. Check your connection and press play again.");
    }
  }

  /**
   * play() with a timeout: the promise can hang forever on a stalled stream,
   * which used to strand the UI on the spinner with no error. Only declares
   * failure if playback genuinely never started.
   */
  async function startPlayback(el: HTMLAudioElement) {
    const st = usePlayer.getState();
    st.setAudioError(null);
    try {
      await Promise.race([
        el.play(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("playback timeout")), 20_000),
        ),
      ]);
    } catch {
      // Only a failure if we still want to be playing — a user pause that
      // lands mid-load rejects play() too, and that is not an error.
      const now = usePlayer.getState();
      st.setBuffering(false);
      if (el.paused && now.isPlaying) {
        st.setPlaying(false);
        st.setAudioError("Playback didn't start — the file may be unreachable. Check your connection and press play again.");
      }
    }
  }

  async function handleEnded() {
    const state = usePlayer.getState();
    const { queue, index } = state;
    if (index + 1 < queue.length) {
      state.next();
      return;
    }
    // Auto-continue: same-genre tracks, excluding this session's history.
    const current = state.current();
    if (!current || autoContinueTried.current === current.queueKey) {
      state.setPlaying(false);
      return;
    }
    autoContinueTried.current = current.queueKey;
    try {
      const params = new URLSearchParams({
        songId: current.id,
        exclude: state.playedSessionIds.join(","),
      });
      const res = await fetch(`/api/similar?${params}`);
      if (!res.ok) throw new Error("no similar");
      const json = (await res.json()) as { tracks: import("@/lib/db-types").Track[] };
      if (json.tracks.length === 0) {
        state.setPlaying(false);
        return;
      }
      const { addToQueue } = state;
      json.tracks.forEach((t) => addToQueue(t));
      state.next();
    } catch {
      state.setPlaying(false);
    }
  }

  return null;
}
