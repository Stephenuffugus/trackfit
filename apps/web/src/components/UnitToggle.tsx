import type { Unit } from "../lib/types";

interface Props {
  unit: Unit;
  onChange: (unit: Unit) => void;
}

export function UnitToggle({ unit, onChange }: Props) {
  return (
    <div className="unit-toggle">
      <button
        type="button"
        className={unit === "in" ? "active" : ""}
        onClick={() => onChange("in")}
      >
        Inches
      </button>
      <button
        type="button"
        className={unit === "mm" ? "active" : ""}
        onClick={() => onChange("mm")}
      >
        Millimeters
      </button>
    </div>
  );
}
