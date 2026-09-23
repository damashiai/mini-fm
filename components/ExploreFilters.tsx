"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";
import { SORT_LABELS, type SortKey } from "@/lib/sort";
import Dropdown, { type DropdownOption } from "./Dropdown";

export interface FilterOptions {
  genres: { id: string; name: string; slug: string }[];
  languages: { code: string; name: string }[];
  artists: { id: string; name: string }[];
  decades: string[];
}

function toOptions<T>(
  items: T[],
  getValue: (t: T) => string,
  getLabel: (t: T) => string,
  allLabel: string,
): DropdownOption[] {
  return [{ value: "", label: allLabel }, ...items.map((t) => ({ value: getValue(t), label: getLabel(t) }))];
}

export default function ExploreFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // Visible transition while the server re-renders the grid.
    startTransition(() => {
      router.push(`/explore?${next.toString()}`);
    });
  };

  return (
    <div className="space-y-2">
      {isPending && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2" aria-live="polite">
          <span className="animate-pulse rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-white shadow-xl">
            Updating…
          </span>
        </div>
      )}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          defaultValue={params.get("q") ?? ""}
          key={params.get("q") ?? "q"}
          placeholder="Search songs, artists, albums…"
          onKeyDown={(e) => {
            if (e.key === "Enter") set("q", (e.target as HTMLInputElement).value.trim());
          }}
          onBlur={(e) => {
            if (e.target.value.trim() !== (params.get("q") ?? "")) set("q", e.target.value.trim());
          }}
          className="w-full rounded-xl border border-line bg-coal py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-muted/70 focus:border-brand"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Dropdown
          label="All genres"
          value={params.get("genre") ?? ""}
          options={toOptions(options.genres, (g) => g.slug, (g) => g.name, "All genres")}
          onChange={(v) => set("genre", v)}
        />
        <Dropdown
          label="All languages"
          value={params.get("language") ?? ""}
          options={toOptions(options.languages, (l) => l.code, (l) => l.name, "All languages")}
          onChange={(v) => set("language", v)}
        />
        <Dropdown
          label="All artists"
          value={params.get("artist") ?? ""}
          options={toOptions(options.artists, (a) => a.id, (a) => a.name, "All artists")}
          onChange={(v) => set("artist", v)}
        />
        <Dropdown
          label="Any decade"
          value={params.get("decade") ?? ""}
          options={toOptions(options.decades, (d) => d, (d) => d, "Any decade")}
          onChange={(v) => set("decade", v)}
        />
        <Dropdown
          label="Sort"
          value={params.get("sort") ?? "recent"}
          options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
            value: k,
            label: SORT_LABELS[k]!,
          }))}
          onChange={(v) => set("sort", v)}
        />
      </div>
    </div>
  );
}
