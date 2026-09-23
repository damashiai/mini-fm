"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

/** Copies the current share URL to the clipboard. */
export default function SharePlaylistButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="flex items-center gap-2 rounded-full border border-line px-6 py-2.5 text-sm font-semibold hover:bg-card"
    >
      {copied ? <Check size={15} /> : <Link2 size={15} />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
