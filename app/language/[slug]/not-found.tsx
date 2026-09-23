import ErrorCard from "@/components/ErrorCard";

export default function LanguageNotFound() {
  return (
    <ErrorCard
      code="404"
      title="Unknown language"
      message="No shelf for that language yet — browse everything instead."
    />
  );
}
