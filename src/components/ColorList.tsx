import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { GAMUT_STATUS_LABELS } from "../gamut/classify";
import type { GamutResult } from "../gamut/types";
import type { ResolvedColor } from "../types";
import { arrangeColors, type SortDirection, type SortKey, type StatusFilter } from "./colorListModel";

type ColorListProps = {
  colors: ResolvedColor[];
  selectedId: string | null;
  gamutResults: Map<string, GamutResult> | null;
  onSelect: (id: string) => void;
};

const sortOptions: Array<{ value: SortKey; label: string; needsGamut?: boolean }> = [
  { value: "name", label: "Name" },
  { value: "deltaE", label: "Achievable ΔE", needsGamut: true },
  { value: "l", label: "L*" },
  { value: "chroma", label: "Chroma" },
  { value: "hue", label: "Hue" },
];

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "in", label: "In gamut" },
  { value: "within", label: "Within tol" },
  { value: "out", label: "Out" },
];

export default function ColorList({ colors, selectedId, gamutResults, onSelect }: ColorListProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const hasGamut = gamutResults !== null;
  const shownSortKey = !hasGamut && sortKey === "deltaE" ? "name" : sortKey;

  const visibleColors = useMemo(
    () => arrangeColors(colors, { query, sortKey, direction, statusFilter }, gamutResults),
    [colors, direction, gamutResults, query, sortKey, statusFilter],
  );

  return (
    <section className="panel-section color-list-section" aria-labelledby="color-list-heading">
      <div className="section-heading-row">
        <h2 id="color-list-heading">Resolved Colors</h2>
        <span>{visibleColors.length}</span>
      </div>
      <label className="search-field">
        <Search aria-hidden="true" size={15} />
        <input
          type="search"
          placeholder="Search colors"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      <div className="list-controls">
        <label className="field">
          <span>Sort</span>
          <select value={shownSortKey} onChange={(event) => setSortKey(event.currentTarget.value as SortKey)}>
            {sortOptions
              .filter((option) => hasGamut || !option.needsGamut)
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </label>
        <button
          type="button"
          className="icon-button"
          aria-label={direction === "asc" ? "Sort descending" : "Sort ascending"}
          title={direction === "asc" ? "Ascending" : "Descending"}
          onClick={() => setDirection(direction === "asc" ? "desc" : "asc")}
        >
          {direction === "asc" ? <ArrowUpNarrowWide size={15} /> : <ArrowDownWideNarrow size={15} />}
        </button>
      </div>
      {hasGamut && (
        <div className="status-chips" role="group" aria-label="Filter by gamut status">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`status-chip${filter.value !== "all" ? ` status-${filter.value}` : ""}${
                statusFilter === filter.value ? " is-active" : ""
              }`}
              aria-pressed={statusFilter === filter.value}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}
      <div className="color-list" role="listbox" aria-label="Resolved colors">
        {visibleColors.map((color) => {
          const selected = color.id === selectedId;
          const result = gamutResults?.get(color.id);

          return (
            <button
              key={color.id}
              className={`color-row${selected ? " is-selected" : ""}`}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(color.id)}
            >
              <span className="color-swatch" style={{ background: color.displayRgb }} />
              <span className="color-row-main">
                <strong>{color.name}</strong>
                <small>
                  L {color.lab.l.toFixed(1)} · a {color.lab.a.toFixed(1)} · b {color.lab.b.toFixed(1)}
                </small>
              </span>
              <span className="source-pill">{color.source}</span>
              {result && (
                <span className={`delta-badge status-${result.status}`} title={GAMUT_STATUS_LABELS[result.status]}>
                  {result.achievableDeltaE.toFixed(2)}
                </span>
              )}
            </button>
          );
        })}
        {visibleColors.length === 0 && <p className="empty-list">No resolved colors match.</p>}
      </div>
    </section>
  );
}
