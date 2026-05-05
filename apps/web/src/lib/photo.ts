import { MAX_PHOTO_DIM, PHOTO_QUALITY } from "./constants";

/**
 * Read a File, decode it, and resize to a JPEG data URL whose longest side
 * is at most MAX_PHOTO_DIM pixels. Quality fixed at PHOTO_QUALITY.
 *
 * Ported verbatim from v0.2 (the canvas-based pipeline). Used for both
 * inventory-row photos and the gap reference photo.
 */
export function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        const longest = Math.max(img.width, img.height);
        const scale = longest > MAX_PHOTO_DIM ? MAX_PHOTO_DIM / longest : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", PHOTO_QUALITY));
        } catch (err) {
          reject(err as Error);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
