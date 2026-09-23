import ErrorCard from "@/components/ErrorCard";

export default function AdminArtistNotFound() {
  return (
    <ErrorCard
      code="404"
      title="Artist not found"
      message="This artist was deleted or the ID is wrong."
      homeHref="/admin"
    />
  );
}
