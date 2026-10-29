import { createRequire } from "node:module";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const source = path.dirname(require.resolve("pdfjs-dist/package.json"));
const { version } = JSON.parse(await readFile(path.join(source, "package.json"), "utf8"));
const target = fileURLToPath(new URL(`../public/pdfjs/${version}/`, import.meta.url));
await mkdir(target, { recursive: true });
await copyFile(path.join(source, "legacy/build/pdf.worker.min.mjs"), path.join(target, "pdf.worker.min.mjs"));
await copyFile(path.join(source, "LICENSE"), path.join(target, "LICENSE"));
