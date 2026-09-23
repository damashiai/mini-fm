import { HeaderSkeleton, SongRowsSkeleton } from "@/components/Skeletons";

export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-label="Loading admin">
      <HeaderSkeleton />
      <SongRowsSkeleton count={8} />
    </div>
  );
}
