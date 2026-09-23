"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="text-6xl font-black text-brand">500</p>
      <h1 className="mt-4 text-xl font-bold">Something went wrong on our end</h1>
      <p className="mt-2 text-sm text-muted">Please try again in a moment.</p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-brand px-5 py-2 text-sm font-bold hover:bg-brandDark"
      >
        Try again
      </button>
    </div>
  );
}
