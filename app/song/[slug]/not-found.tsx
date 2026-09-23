import ErrorCard from "@/components/ErrorCard";

export default function SongNotFound() {
  return (
    <ErrorCard
      code="404"
      title="This track doesn't exist"
      message="It may have been deleted by the admin, or the URL is wrong."
    />
  );
}
