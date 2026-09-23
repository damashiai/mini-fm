import { HeroSkeleton, SongRowsSkeleton } from "@/components/Skeletons";

export default function SongLoading() {
  return (
    <div className="space-y-8" aria-label="Loading track">
      <HeroSkeleton />
      <SongRowsSkeleton count={5} />
    </div>
  );
}
