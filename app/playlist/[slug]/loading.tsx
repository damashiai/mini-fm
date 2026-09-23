import { HeaderSkeleton, SongRowsSkeleton } from "@/components/Skeletons";

export default function PlaylistLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-label="Loading mix">
      <HeaderSkeleton />
      <SongRowsSkeleton count={10} />
    </div>
  );
}
