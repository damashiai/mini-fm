/**
 * Shared shimmer skeletons — used by every `loading.tsx` route boundary and
 * by inline loaders (mood results, lyrics, library). The `.skeleton` class
 * lives in app/globals.css.
 */

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <span aria-hidden style={style} className={`skeleton block rounded-md ${className}`} />;
}

export function SongGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl bg-card">
          <Skeleton className="aspect-square !rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SongRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="divide-y divide-line/60 rounded-xl border border-line bg-coal px-2 py-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="h-11 w-11 shrink-0 !rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-3 w-10 sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Poster/disc hero (song, album, artist pages). */
export function HeroSkeleton({ round = "rounded-2xl" }: { round?: string }) {
  return (
    <div className="flex animate-pulse flex-col gap-6 sm:flex-row">
      <Skeleton className={`aspect-square w-full max-w-xs ${round}`} />
      <div className="flex-1 space-y-3 pt-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-6 w-16 !rounded-full" />
          <Skeleton className="h-6 w-20 !rounded-full" />
          <Skeleton className="h-6 w-14 !rounded-full" />
        </div>
        <div className="flex gap-2 pt-3">
          <Skeleton className="h-10 w-32 !rounded-full" />
          <Skeleton className="h-10 w-24 !rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** Filter pill row (explore, genre/language sort links). */
export function ChipsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-8 !rounded-full"
          style={{ width: [96, 128, 80, 150, 110, 90][i % 6] } as React.CSSProperties}
        />
      ))}
      <span className="sr-only">Loading filters…</span>
    </div>
  );
}

/** Labeled form (admin upload review, song edit, login). */
export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full !rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-10 w-40 !rounded-lg" />
    </div>
  );
}

/** Page header block (charts, library, explore titles). */
export function HeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

/** Centered lyric-line shimmer for the lyrics overlay loader. */
export function LyricsSkeleton() {
  const widths = ["85%", "70%", "90%", "60%", "78%", "66%", "82%"];
  return (
    <div className="mx-auto max-w-xl space-y-4 py-8" aria-label="Loading lyrics">
      {widths.map((w, i) => (
        <Skeleton key={i} className="mx-auto h-6" style={{ width: w } as React.CSSProperties} />
      ))}
    </div>
  );
}
