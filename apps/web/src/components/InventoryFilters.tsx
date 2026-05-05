import type { TrackKind } from "@trackfit/library";

export type InventoryFilter = "all" | "straight" | "curve" | "turnout" | "crossing";

interface Props {
  active: InventoryFilter;
  counts: Record<InventoryFilter, number>;
  onChange: (next: InventoryFilter) => void;
}

const FILTERS: { id: InventoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "straight", label: "Straights" },
  { id: "curve", label: "Curves" },
  { id: "turnout", label: "Turnouts" },
  { id: "crossing", label: "Crossings" },
];

/**
 * Filter chips that hide rows by track kind. Pure UI — the underlying
 * inventory array is untouched; we just render a subset. Counts are shown
 * subscript so a hobbyist can see at a glance "I've got 0 turnouts".
 */
export function InventoryFilters({ active, counts, onChange }: Props) {
  return (
    <div className="inv-filters" role="tablist" aria-label="Filter inventory by piece kind">
      {FILTERS.map((f) => {
        const n = counts[f.id];
        const isActive = active === f.id;
        return (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`inv-filter${isActive ? " inv-filter--active" : ""}`}
            onClick={() => onChange(f.id)}
          >
            <span>{f.label}</span>
            <span className="inv-filter__count">{n}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Group an inventory row's kind into one of the filter buckets. */
export function bucketOf(kind: TrackKind | undefined): InventoryFilter {
  if (kind === "curve") return "curve";
  if (kind === "turnout") return "turnout";
  if (kind === "crossing") return "crossing";
  // straights, fitters, flex, and "manually added" all roll up under straights
  // because that's how an older hobbyist thinks about them — anything that
  // isn't curved or branching is "a straight".
  return "straight";
}
