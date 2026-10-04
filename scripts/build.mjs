import { build } from "esbuild";
import { cp, mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

// dist is disposable build output; the source and public assets remain untouched.
await rm("dist", { recursive: true, force: true });
await mkdir("dist/assets", { recursive: true });
await build({
  entryPoints: { app: "src/app.js", styles: "src/styles.css" },
  outdir: "dist/assets",
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  chunkNames: "chunks/[name]-[hash]",
  legalComments: "eof",
});
await cp("public", "dist", { recursive: true });
await cp("index.html", "dist/index.html");
async function files(dir, prefix = "") {
  const items = await readdir(dir, { withFileTypes: true });
  const all = [];
  for (const item of items) {
    const relative = join(prefix, item.name);
    if (item.isDirectory())
      all.push(...(await files(join(dir, item.name), relative)));
    else if (relative !== "sw.js") all.push(relative);
  }
  return all.sort();
}
const assets = await files("dist"),
  hash = createHash("sha256");
for (const name of assets) hash.update(await readFile(join("dist", name)));
const template = await readFile("public/sw.js", "utf8");
const worker = template
  .replace(
    "__CACHE_VERSION__",
    "job-discipline-" + hash.digest("hex").slice(0, 12),
  )
  .replace(
    "__PRECACHE_FILES__",
    JSON.stringify(["./", ...assets.map((name) => "./" + name)]),
  );
await writeFile("dist/sw.js", worker);
console.log(`Built ${assets.length} app assets in dist/.`);
