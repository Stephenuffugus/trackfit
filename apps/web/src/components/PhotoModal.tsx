import { useFocusTrap } from "../hooks/useFocusTrap";

interface Props {
  open: boolean;
  src: string | null;
  label: string;
  sizeText: string;
  onClose: () => void;
  onRemove: () => void;
}

/**
 * Full-size photo viewer. Click the dimmed backdrop, press ESC, or hit
 * the Close button to dismiss; Remove deletes the photo from the
 * underlying state.
 */
export function PhotoModal({
  open,
  src,
  label,
  sizeText,
  onClose,
  onRemove,
}: Props) {
  // Trap Tab cycling inside the modal and restore focus to the photo
  // thumbnail (or whichever button opened the modal) on close. Initial
  // focus lands on the dialog container itself, NOT on the first
  // button — that first button is "Remove photo" (destructive), and
  // an accidental Enter on modal-open would silently delete the
  // image. The user must tab once to reach Remove, which is the
  // safer default for the older audience.
  const containerRef = useFocusTrap<HTMLDivElement>({
    enabled: open,
    onEscape: onClose,
    initialFocus: "container",
  });

  return (
    <div
      ref={containerRef}
      className={`modal${open ? " open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <img className="modal-img" src={src ?? ""} alt="" />
        <div className="modal-meta">
          <span>{label}</span>
          <span>{sizeText}</span>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn danger" onClick={onRemove}>
            Remove photo
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
