// Run from web/: node scripts/generate-admin-icons.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const directory = new URL("../public/pwa/admin/", import.meta.url);
for (const [filename, size] of [["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]]) {
  await sharp(fileURLToPath(new URL("icon.svg", directory)))
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(filename, directory)));
}
