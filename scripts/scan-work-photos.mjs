// Lists every image in public/work/<slug>/ and writes the result to
// src/components/portfolio/work-photos.json, so adding or removing a photo is
// just adding or removing the file. Runs automatically before `dev` and
// `build`; run `npm run photos` by hand after changing files mid-session.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const WORK_DIR = path.join(process.cwd(), "public", "work");
const OUT_FILE = path.join(process.cwd(), "src", "components", "portfolio", "work-photos.json");
const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i;

const manifest = {};
for (const slug of readdirSync(WORK_DIR).sort()) {
  const dir = path.join(WORK_DIR, slug);
  if (!statSync(dir).isDirectory()) continue;
  manifest[slug] = readdirSync(dir)
    .filter((f) => IMAGE_EXT.test(f) && !f.startsWith("."))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => `/work/${slug}/${f}`);
}

writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + "\n");
const total = Object.values(manifest).reduce((n, list) => n + list.length, 0);
console.log(`work photos: ${total} across ${Object.keys(manifest).length} folders`);
