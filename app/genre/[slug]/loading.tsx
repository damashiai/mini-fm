import { ChipsSkeleton, HeaderSkeleton, SongGridSkeleton } from "@/components/Skeletons";

export default function GenreLoading() {
  return (
    <div className="space-y-6" aria-label="Loading genre">
      <HeaderSkeleton />
      <ChipsSkeleton count={4} />
      <SongGridSkeleton />
    </div>
  );
}
