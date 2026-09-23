"use client";

/**
 * Anonymous visitor id stored in localStorage. Powers the "Liked Songs" and
 * "Recently Played" shelves without building user accounts (spec §5.7).
 */
const KEY = "minifm-session-id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
