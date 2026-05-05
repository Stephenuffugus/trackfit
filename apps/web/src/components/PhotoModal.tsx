interface Props {
  open: boolean;
  src: string | null;
  label: string;
  sizeText: string;
  onClose: () => void;
  onRemove: () => void;
}

/**
 * Full-size photo viewer. Click the dimmed backdrop or the Close button to
 * dismiss; Remove deletes the photo from the underlying state.
 */
export function PhotoModal({
  open,
  src,
  label,
  sizeText,
  onClose,
  onRemove,
}: Props) {
  return (
    <div
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
