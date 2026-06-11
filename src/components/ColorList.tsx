import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ResolvedColor } from "../types";

type ColorListProps = {
  colors: ResolvedColor[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const includesQuery = (color: ResolvedColor, query: string) => {
  const haystack = `${color.name} ${color.id} ${color.source} ${color.path ?? ""}`.toLowerCase();
  return haystack.includes(query);
};

export default function ColorList({ colors, selectedId, onSelect }: ColorListProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredColors = useMemo(
    () => (normalizedQuery ? colors.filter((color) => includesQuery(color, normalizedQuery)) : colors),
    [colors, normalizedQuery],
  );

  return (
    <section className="panel-section color-list-section" aria-labelledby="color-list-heading">
      <div className="section-heading-row">
        <h2 id="color-list-heading">Resolved Colors</h2>
        <span>{filteredColors.length}</span>
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
      <div className="color-list" role="listbox" aria-label="Resolved colors">
        {filteredColors.map((color) => {
          const selected = color.id === selectedId;

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
            </button>
          );
        })}
        {filteredColors.length === 0 && <p className="empty-list">No resolved colors match.</p>}
      </div>
    </section>
  );
}
