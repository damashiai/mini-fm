/**
 * Shared Open Graph card. Titles scale down with length and clip with an
 * ellipsis on one line — long track/album/artist names can never overflow
 * the 1200×630 canvas.
 */

function titleSize(title: string): number {
  const len = [...title].length;
  if (len <= 18) return 80;
  if (len <= 30) return 64;
  if (len <= 45) return 52;
  if (len <= 65) return 42;
  return 34;
}

export function OgCard({
  kicker,
  title,
  subtitle,
  art,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  /** Rendered left of the text (cover art or collage). */
  art?: React.ReactNode;
}) {
  const size = titleSize(title);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 48,
        background: "#141414",
        color: "#fff",
        padding: 64,
        fontFamily: "sans-serif",
      }}
    >
      {art}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: "1 1 0%",
          minWidth: 0,
        }}
      >
        <div style={{ fontSize: 30, color: "#E50914", fontWeight: 800 }}>{kicker}</div>
        <div
          style={{
            fontSize: size,
            fontWeight: 900,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}
        >
          {title.slice(0, 100)}
        </div>
        {subtitle ? (
          <div
            style={{
              fontSize: Math.round(size * 0.45),
              color: "#a3a3a3",
              marginTop: 12,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {subtitle.slice(0, 100)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function OgArt({ src, size = 300 }: { src: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} style={{ borderRadius: 24 }} />;
}

export function OgPlaceholder({ size = 300 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 24,
        background: "#E50914",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size / 2,
        fontWeight: 900,
        color: "#fff",
      }}
    >
      M
    </div>
  );
}
