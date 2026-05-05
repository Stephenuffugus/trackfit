import { listSystems } from "@trackfit/library";
import type { TrackSystem } from "@trackfit/library";

interface Props {
  activeId: string | null;
  onSelect: (system: TrackSystem) => void;
}

/**
 * Loads every track system from the library package and renders a row of
 * chips. Systems whose data_quality is "unverified-draft" carry a small
 * "DRAFT" badge so the user knows the lengths haven't been triple-checked
 * against the manufacturer's catalog yet.
 */
export function PresetChips({ activeId, onSelect }: Props) {
  const systems = listSystems();
  return (
    <div className="chips" id="presetChips">
      {systems.map((sys) => {
        const isDraft = sys.data_quality === "unverified-draft";
        const isActive = sys.id === activeId;
        return (
          <button
            key={sys.id}
            className={`chip${isActive ? " active" : ""}`}
            data-id={sys.id}
            type="button"
            onClick={() => onSelect(sys)}
            title={isDraft ? sys.data_quality_note ?? "Draft data" : undefined}
          >
            <span>{sys.name}</span>
            {isDraft ? <span className="draft-badge">Draft</span> : null}
          </button>
        );
      })}
    </div>
  );
}
