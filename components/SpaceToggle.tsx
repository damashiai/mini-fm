"use client";

import { useEffect } from "react";
import { usePlayer } from "./player-store";

/**
 * Keyboard transport: Space toggles play/pause instead of scrolling the page,
 * ←/→ seek ∓5s. Ignored while typing (inputs, textareas, selects,
 * content-editable) and on key repeat — but works everywhere else, including
 * with the lyrics overlay open. Focused buttons/links keep native behavior.
 */
export default function SpaceToggle() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName ?? "";
      const typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (t?.isContentEditable ?? false);
      const st = () => usePlayer.getState();
      if (e.code === "Space") {
        if (typing) return;
        // Let focused buttons/links keep native space behavior (click).
        if (tag === "BUTTON" || tag === "A") return;
        e.preventDefault();
        const { queue, isPlaying, setPlaying } = st();
        if (queue.length > 0) setPlaying(!isPlaying);
        return;
      }
      if ((e.code === "ArrowLeft" || e.code === "ArrowRight") && !typing) {
        const { queue } = st();
        if (queue.length === 0) return;
        e.preventDefault();
        const delta = e.code === "ArrowLeft" ? -5 : 5;
        const next = Math.max(0, st().currentTime + delta);
        document.dispatchEvent(new CustomEvent("minifm:seek", { detail: next }));
        st().setTime(next);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
