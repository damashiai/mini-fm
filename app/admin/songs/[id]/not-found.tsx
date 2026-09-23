import ErrorCard from "@/components/ErrorCard";

export default function AdminSongNotFound() {
  return (
    <ErrorCard
      code="404"
      title="Track not found"
      message="This song was deleted or the ID is wrong."
      homeHref="/admin"
    />
  );
}
