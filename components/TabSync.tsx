"use client";

import { useEffect, useRef } from "react";
import { usePlayer } from "./player-store";

/**
 * Multi-tab playback sync: at most one tab is ever audible. Whenever a tab
 * starts playing it broadcasts a claim; every other tab pauses itself.
 * Volume/mute also follow the most recent change. No leader election needed:
 * only play/volume transitions broadcast, pauses never echo, so the protocol
 * can't loop. Simultaneous claims resolve by timestamp (then tab id).
 */
export default function TabSync() {
  const tabId = useRef(
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const bcRef = useRef<BroadcastChannel | null>(null);
  const myClaimTs = useRef(0);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel("minifm-player");
    bcRef.current = bc;

    bc.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as
        | { type: "claim"; tab: string; ts: number }
        | { type: "vol"; tab: string; volume: number; muted: boolean };
      if (!msg || msg.tab === tabId.current) return;
      const st = usePlayer.getState();
      if (msg.type === "claim") {
        // Tie-break: a newer local claim wins over an older remote one.
        if (msg.ts < myClaimTs.current) return;
        if (msg.ts === myClaimTs.current && msg.tab < tabId.current) return;
        if (st.isPlaying) st.setPlaying(false);
      } else if (msg.type === "vol") {
        if (st.volume !== msg.volume) st.setVolume(msg.volume);
        if (st.muted !== msg.muted) st.setMuted(msg.muted);
      }
    };

    const unsub = usePlayer.subscribe((s, prev) => {
      const bc = bcRef.current;
      if (!bc) return;
      // Local play intent → claim. Pauses never broadcast (no echo loops).
      if (s.isPlaying && !prev.isPlaying) {
        myClaimTs.current = Date.now();
        bc.postMessage({ type: "claim", tab: tabId.current, ts: myClaimTs.current });
      }
      if (s.volume !== prev.volume || s.muted !== prev.muted) {
        bc.postMessage({
          type: "vol",
          tab: tabId.current,
          volume: s.volume,
          muted: s.muted,
        });
      }
    });

    return () => {
      unsub();
      bc.close();
      bcRef.current = null;
    };
  }, []);

  return null;
}
