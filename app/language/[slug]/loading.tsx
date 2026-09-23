import { ChipsSkeleton, HeaderSkeleton, SongGridSkeleton } from "@/components/Skeletons";

export default function LanguageLoading() {
  return (
    <div className="space-y-6" aria-label="Loading language">
      <HeaderSkeleton />
      <ChipsSkeleton count={4} />
      <SongGridSkeleton />
    </div>
  );
}
