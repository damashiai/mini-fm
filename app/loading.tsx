import { HeaderSkeleton, SongGridSkeleton, SongRowsSkeleton } from "@/components/Skeletons";

export default function RootLoading() {
  return (
    <div className="space-y-10" aria-label="Loading">
      <HeaderSkeleton />
      <SongGridSkeleton count={5} />
      <SongRowsSkeleton count={5} />
    </div>
  );
}
