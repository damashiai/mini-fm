export type SortKey = "recent" | "az" | "released" | "played";

export const SORT_LABELS: Record<SortKey, string> = {
  recent: "Recently added",
  az: "A–Z",
  released: "Recently released",
  played: "Most played",
};
