/**
 * Browser file-download helper.
 *
 * Used by the cut-template button to deliver a generated PDF to the user
 * without uploading it. Strategy: wrap the bytes in a Blob, mint a Blob URL,
 * fire a synthetic click on a hidden <a download>, then revoke the URL on a
 * microtask so memory is reclaimed but the download has time to start.
 *
 * Why not data: URLs? Some browsers (mobile Safari especially) cap data:
 * URL length and refuse large PDF payloads. Blob URLs sidestep that limit.
 */

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  // BlobPart requires ArrayBuffer (not ArrayBufferLike) under TS 5.7's stricter
  // typing. A Uint8Array.from copy gives us a fresh ArrayBuffer-backed view
  // and costs ~one alloc for a typical PDF (a few hundred KB).
  const buf = Uint8Array.from(bytes);
  const blob = new Blob([buf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    // Some browsers require the element to be in the document for the
    // synthetic click to dispatch a download.
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Defer revocation so the browser has actually consumed the URL by the
    // time we drop our reference.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
