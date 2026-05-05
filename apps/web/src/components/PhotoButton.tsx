interface Props {
  photo: string | null;
  size?: "sm" | "lg";
  ariaLabel: string;
  onClick: () => void;
  /** Used as alt text for the rendered photo. */
  alt?: string;
}

/**
 * The specimen-frame photo button. Renders a square with corner ticks; if
 * `photo` is null, fills with a hatched diagonal pattern and a "+ photo"
 * affordance. Otherwise shows the captured image.
 *
 * Two sizes:
 *   sm = 56×56 (48×48 mobile)  — used in inventory rows
 *   lg = 96×96 (80×80 mobile)  — used for the gap reference photo
 */
export function PhotoButton({
  photo,
  size = "sm",
  ariaLabel,
  onClick,
  alt,
}: Props) {
  const cls = [
    "photo-btn",
    size === "lg" ? "lg" : "",
    photo ? "has-photo" : "empty",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={cls}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {photo ? (
        <img src={photo} alt={alt ?? ""} />
      ) : (
        <>
          <span className="cam-icon">+ photo</span>
          <span className="corner-tl" />
          <span className="corner-br" />
        </>
      )}
    </button>
  );
}
