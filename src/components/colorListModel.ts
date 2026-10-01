import type { GamutResult, GamutStatus } from "../gamut/types";
import type { ResolvedColor } from "../types";

export type SortKey = "name" | "deltaE" | "l" | "chroma" | "hue";
export type SortDirection = "asc" | "desc";
export type StatusFilter = "all" | GamutStatus;

export type ListOptions = {
  query: string;
  sortKey: SortKey;
  direction: SortDirection;
  statusFilter: StatusFilter;
};

const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const includesQuery = (color: ResolvedColor, query: string) => {
  const haystack = `${color.name} ${color.id} ${color.source} ${color.path ?? ""}`.toLowerCase();
  return haystack.includes(query);
};

const hueDegrees = (color: ResolvedColor) => {
  const hue = (Math.atan2(color.lab.b, color.lab.a) * 180) / Math.PI;
  return hue >= 0 ? hue : hue + 360;
};

export function arrangeColors(
  colors: ResolvedColor[],
  { query, sortKey, direction, statusFilter }: ListOptions,
  results: Map<string, GamutResult> | null,
): ResolvedColor[] {
  const normalizedQuery = query.trim().toLowerCase();
  const effectiveSortKey = !results && sortKey === "deltaE" ? "name" : sortKey;

  const filtered = colors.filter(
    (color) =>
      (!normalizedQuery || includesQuery(color, normalizedQuery)) &&
      (!results || statusFilter === "all" || results.get(color.id)?.status === statusFilter),
  );

  const sortValue = (color: ResolvedColor) => {
    switch (effectiveSortKey) {
      case "deltaE":
        return results?.get(color.id)?.achievableDeltaE ?? Infinity;
      case "l":
        return color.lab.l;
      case "chroma":
        return Math.hypot(color.lab.a, color.lab.b);
      case "hue":
        return hueDegrees(color);
      case "name":
        return 0;
    }
  };

  const sign = direction === "asc" ? 1 : -1;
  return [...filtered].sort((left, right) => {
    const primary =
      effectiveSortKey === "name" ? nameCollator.compare(left.name, right.name) : sortValue(left) - sortValue(right);
    return primary !== 0 ? primary * sign : nameCollator.compare(left.name, right.name);
  });
}
