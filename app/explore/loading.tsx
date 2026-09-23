import { ChipsSkeleton, HeaderSkeleton, SongGridSkeleton } from "@/components/Skeletons";

export default function ExploreLoading() {
  return (
    <div className="space-y-6" aria-label="Loading explore">
      <HeaderSkeleton />
      <ChipsSkeleton />
      <SongGridSkeleton />
    </div>
  );
}
