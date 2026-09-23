import ErrorCard from "@/components/ErrorCard";

export default function GenreNotFound() {
  return (
    <ErrorCard
      code="404"
      title="Unknown genre"
      message="We don't have that genre shelf — browse everything instead."
    />
  );
}
