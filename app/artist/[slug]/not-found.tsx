import ErrorCard from "@/components/ErrorCard";

export default function ArtistNotFound() {
  return (
    <ErrorCard
      code="404"
      title="Artist not found"
      message="This artist isn't in the catalog yet — try searching for something else."
    />
  );
}
