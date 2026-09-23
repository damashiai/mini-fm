import { FormSkeleton, HeaderSkeleton } from "@/components/Skeletons";

export default function AdminSongEditLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-label="Loading editor">
      <HeaderSkeleton />
      <FormSkeleton fields={8} />
    </div>
  );
}
