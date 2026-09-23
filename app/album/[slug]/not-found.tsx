import ErrorCard from "@/components/ErrorCard";

export default function AlbumNotFound() {
  return (
    <ErrorCard
      code="404"
      title="Release not found"
      message="This album, single or EP isn't in the catalog — or it was removed."
    />
  );
}
