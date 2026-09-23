"use client";

import dynamic from "next/dynamic";
import { FormSkeleton, HeaderSkeleton } from "./Skeletons";

// music-metadata-browser is the heaviest client dependency in the app — load
// it only when an admin actually visits the uploader, never in the base
// bundles. Must live in a Client Component for ssr:false.
const BatchUploadForm = dynamic(() => import("./BatchUploadForm"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4" aria-label="Loading uploader">
      <HeaderSkeleton />
      <FormSkeleton fields={4} />
    </div>
  ),
});

export default function UploadLoader() {
  return <BatchUploadForm />;
}
