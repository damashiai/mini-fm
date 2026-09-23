import { HeroSkeleton, SongGridSkeleton, SongRowsSkeleton } from "@/components/Skeletons";

export default function ArtistLoading() {
  return (
    <div className="space-y-8" aria-label="Loading artist">
      <HeroSkeleton round="rounded-full" />
      <SongRowsSkeleton count={5} />
      <SongGridSkeleton count={4} />
    </div>
  );
}
