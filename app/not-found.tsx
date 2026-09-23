import ErrorCard from "@/components/ErrorCard";

export default function RootNotFound() {
  return (
    <ErrorCard
      code="404"
      title="We couldn't find that track or page"
      message="It may have been removed — or the link expired (shared mixes last 7 days)."
    />
  );
}
