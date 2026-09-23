import { HeaderSkeleton, SongRowsSkeleton } from "@/components/Skeletons";

export default function LibraryLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-10" aria-label="Loading library">
      <HeaderSkeleton />
      <SongRowsSkeleton count={5} />
      <SongRowsSkeleton count={5} />
    </div>
  );
}
