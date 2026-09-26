// Client-side photo prep for portfolio uploads: phone photos are often
// 4000px+ and 5–15 MB, so downscale to a web-sized JPEG before upload. Keeps
// uploads fast on mobile data and the bucket small. Small JPEGs are sent
// untouched to avoid a needless re-encode.
import { fitWithin } from "@/lib/logoImage";

const MAX_EDGE = 2400;
const QUALITY = 0.86;
const KEEP_ORIGINAL_BYTES = 1.5 * 1024 * 1024;

export async function prepareUpload(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|avif|heic|heif)$/i.test(file.name)) {
    throw new Error(`${file.name} isn't an image`);
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`Couldn't read ${file.name} — try exporting it as a JPG`);
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_EDGE, MAX_EDGE);
    if (file.type === "image/jpeg" && width === bitmap.width && file.size <= KEEP_ORIGINAL_BYTES) return file;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(`Couldn't process ${file.name}`);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`Couldn't process ${file.name}`))), "image/jpeg", QUALITY),
    );
  } finally {
    bitmap.close();
  }
}
