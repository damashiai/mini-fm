import { HeroSkeleton, SongRowsSkeleton } from "@/components/Skeletons";

export default function AlbumLoading() {
  return (
    <div className="space-y-8" aria-label="Loading release">
      <HeroSkeleton />
      <SongRowsSkeleton count={8} />
    </div>
  );
}
