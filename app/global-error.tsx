"use client";

/** Last-resort boundary when even the root layout fails to render. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#141414",
          color: "#f5f5f5",
          fontFamily: "Inter, system-ui, sans-serif",
          minHeight: "100vh",
          margin: 0,
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 56, fontWeight: 900, color: "#E50914", margin: 0 }}>500</p>
          <h1 style={{ fontSize: 20 }}>MiniFM failed to load</h1>
          <p style={{ color: "#a3a3a3", fontSize: 14 }}>
            Something broke at the app shell level. Check your connection and try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              background: "#E50914",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              padding: "8px 20px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
