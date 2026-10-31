// Makes the pin board's web copies from the original photos in Photos/, which git ignores: a small one
// for the board, loaded with the room, and a large one loaded when a photo is held up. Each is turned
// upright, converted to sRGB, and saved as WebP with no metadata (sharp leaves it all out unless asked).
// Run with `npm run photos`, then add any new photo to the list in src/scene/board.ts.
import { mkdir, readdir } from "node:fs/promises";
import sharp from "sharp";

const FROM = "Photos";
const TO = "public/photos";
/** Pixels on each copy's long side. The board paints its prints from these. */
const SIZES = { small: 512, large: 1600 };

await mkdir(TO, { recursive: true });
const files = (await readdir(FROM)).filter((f) => /\.(jpe?g|png|webp|tiff?)$/i.test(f)).sort();
for (const file of files) {
  const name = file.replace(/\.\w+$/, "").toLowerCase();
  for (const [size, long] of Object.entries(SIZES)) {
    const { width, height } = await sharp(`${FROM}/${file}`)
      .rotate()
      .resize(long, long, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(`${TO}/${name}-${size}.webp`);
    if (size === "large") console.log(`${name}: ${width} x ${height}, aspect ${(width / height).toFixed(3)}`);
  }
}
