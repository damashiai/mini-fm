import { FormSkeleton, HeaderSkeleton } from "@/components/Skeletons";

export default function AdminUploadLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6" aria-label="Loading uploader">
      <HeaderSkeleton />
      <FormSkeleton fields={4} />
    </div>
  );
}
