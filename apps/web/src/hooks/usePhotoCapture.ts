import { useCallback, useRef } from "react";
import { resizeImage } from "../lib/photo";

/**
 * v0.2 used a single hidden <input type="file"> that gets re-targeted at
 * each row's photo button. We do the same: one input ref, one handler that
 * routes the captured-and-resized data URL to whichever caller most recently
 * triggered the picker.
 *
 * Usage:
 *
 *   const { capture, inputRef, onInputChange } = usePhotoCapture();
 *   ...
 *   <input ref={inputRef} type="file" accept="image/*"
 *          capture="environment" hidden onChange={onInputChange} />
 *
 * Then call `capture(dataUrl => ...)` to open the native picker.
 */
export function usePhotoCapture() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const callbackRef = useRef<((dataUrl: string) => void) | null>(null);

  const capture = useCallback((onResult: (dataUrl: string) => void) => {
    callbackRef.current = onResult;
    inputRef.current?.click();
  }, []);

  const onInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files && e.target.files[0];
      // Reset value so picking the same file twice still fires change.
      e.target.value = "";
      if (!file) {
        callbackRef.current = null;
        return;
      }
      const cb = callbackRef.current;
      callbackRef.current = null;
      try {
        const dataUrl = await resizeImage(file);
        if (cb) cb(dataUrl);
      } catch (err) {
        alert("Could not read that image. Try a different photo.");
        console.error(err);
      }
    },
    [],
  );

  return { capture, inputRef, onInputChange };
}
