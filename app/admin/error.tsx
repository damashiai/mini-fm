"use client";

import Link from "next/link";

/** Admin-area runtime errors: reset without dropping back to the public site. */
export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="text-6xl font-black text-brand">500</p>
      <h1 className="mt-4 text-xl font-bold">Something broke in admin</h1>
      <p className="mt-2 text-sm text-muted">
        Usually a database or storage hiccup — try again, and check the server logs if it persists.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <button
          onClick={reset}
          className="rounded-lg bg-brand px-5 py-2 text-sm font-bold hover:bg-brandDark"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="rounded-lg border border-line px-5 py-2 text-sm hover:bg-card"
        >
          Admin home
        </Link>
      </div>
    </div>
  );
}
