import type { SortKey } from "@/lib/sort";

const OPTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recently added" },
  { key: "az", label: "A–Z" },
  { key: "released", label: "Recently released" },
  { key: "played", label: "Most played" },
];

export default function SortLinks({ base, current }: { base: string; current: SortKey }) {
  return (
    <div className="flex flex-wrap gap-1">
      {OPTS.map((o) => (
        <a
          key={o.key}
          href={`${base}?sort=${o.key}`}
          className={`rounded-full px-3 py-1 text-xs ${current === o.key ? "bg-brand font-bold" : "bg-card text-muted hover:text-white"}`}
        >
          {o.label}
        </a>
      ))}
    </div>
  );
}
