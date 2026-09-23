import type { Metadata } from "next";
import UploadLoader from "@/components/UploadLoader";

export const metadata: Metadata = { title: "Upload · Admin" };

export default function AdminUploadPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-black">Upload music</h1>
        <p className="text-sm text-muted">
          Drop a batch — each file is hashed for duplicates, tagged from embedded
          metadata, enriched via MusicBrainz, then saved only when you confirm.
        </p>
      </div>
      <UploadLoader />
    </div>
  );
}
