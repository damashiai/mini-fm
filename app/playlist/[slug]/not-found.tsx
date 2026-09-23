import ErrorCard from "@/components/ErrorCard";

export default function PlaylistNotFound() {
  return (
    <ErrorCard
      code="410"
      title="This mix is gone"
      message="Shared mixes expire 7 days after saving — ask the sender for a fresh link, or make your own."
      extraHref="/"
      extraLabel="Make a mix"
    />
  );
}
