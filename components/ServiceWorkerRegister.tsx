"use client";

import { useEffect } from "react";

/** Registers the PWA service worker (app-shell caching only, never audio). */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
