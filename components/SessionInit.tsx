"use client";

import { useEffect } from "react";
import { getSessionId } from "@/lib/session";

/** Ensures the anonymous session id exists for likes/plays (spec §5.7). */
export default function SessionInit() {
  useEffect(() => {
    getSessionId();
  }, []);
  return null;
}
