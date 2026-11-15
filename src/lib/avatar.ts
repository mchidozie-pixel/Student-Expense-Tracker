/**
 * Prepares a profile photo so it always fits inside the student's Firestore
 * profile document (which has a 1 MiB limit and no cloud photo bucket yet).
 *
 * - Photos that are already small are returned untouched.
 * - Larger photos are re-encoded as a square JPEG, stepping down in size and
 *   quality until they fit, so a phone camera photo never breaks the save.
 * - Returns '' when the browser cannot decode the image at all (for example a
 *   HEIC photo picked on a device that cannot open it). Callers should show a
 *   clear message instead of saving the original multi-megabyte file.
 */
export function shrinkAvatarDataUrl(dataUrl: string, maxChars = 110000): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return Promise.resolve(dataUrl);
  if (dataUrl.length <= maxChars) return Promise.resolve(dataUrl);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let size = 224;
      let quality = 0.82;
      let out = '';

      while (size >= 96) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) break;

        // Center-crop to a square so faces stay centered in the circle.
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

        out = canvas.toDataURL('image/jpeg', quality);
        if (out.length <= maxChars) {
          resolve(out);
          return;
        }
        size -= 32;
        quality = Math.max(0.5, quality - 0.08);
      }

      resolve(out && out.length <= maxChars ? out : '');
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}
