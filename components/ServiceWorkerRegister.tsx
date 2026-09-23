"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (app-shell caching only, never audio).
 * Registered in every environment — network-first for navigations, so local
 * dev still shows fresh code, and installability can be verified on
 * localhost without a production build.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
