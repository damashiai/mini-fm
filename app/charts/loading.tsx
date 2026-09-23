import { HeaderSkeleton, SongRowsSkeleton } from "@/components/Skeletons";

export default function ChartsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-10" aria-label="Loading charts">
      <HeaderSkeleton />
      <SongRowsSkeleton count={8} />
      <SongRowsSkeleton count={8} />
    </div>
  );
}
