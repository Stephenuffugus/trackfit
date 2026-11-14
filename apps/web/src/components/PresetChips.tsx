import { listSystems } from "@trackfit/library";
import type { TrackSystem } from "@trackfit/library";

interface Props {
  activeId: string | null;
  onSelect: (system: TrackSystem) => void;
}

const SCALE_ORDER = ["G", "O", "S", "HO", "OO", "TT", "N", "Z"];

/**
 * Brand picker. A native select, grouped by scale: on a phone it opens the
 * system's own large, scrollable list, and the whole choice takes one row
 * instead of a screen of buttons.
 */
export function PresetChips({ activeId, onSelect }: Props) {
  const systems = listSystems();
  const scales = [...new Set(systems.map((s) => s.scale as string))].sort(
    (a, b) => (SCALE_ORDER.indexOf(a) + 99) % 99 - (SCALE_ORDER.indexOf(b) + 99) % 99,
  );
  return (
    <div className="brand-pick" id="presetChips">
      <label className="brand-pick__label" htmlFor="brandSelect">
        Which track do you have?
      </label>
      <select
        id="brandSelect"
        className="brand-pick__select"
        value={activeId ?? ""}
        onChange={(e) => {
          const sys = systems.find((s) => s.id === e.target.value);
          if (sys) onSelect(sys);
        }}
      >
        <option value="" disabled>
          Choose a brand…
        </option>
        {scales.map((scale) => (
          <optgroup key={scale} label={`${scale} scale`}>
            {systems
              .filter((s) => s.scale === scale)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <p className="brand-pick__note">
        This loads every piece the brand makes. Then set how many of each you
        own. Piece sizes come from the makers' published catalogues; if a fit
        really matters, check one piece with a ruler.
      </p>
    </div>
  );
}
