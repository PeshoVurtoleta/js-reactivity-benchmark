// Bundles upstream's own executionOrder() (src/util/benchmark.ts) from the target checkout, unmodified.
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
export async function loadUpstreamBenchmarkModule(runCopy, tmp) {
  mkdirSync(tmp, { recursive: true });
  const require = createRequire(path.join(runCopy, "package.json"));
  const { build } = require("esbuild");
  const outfile = path.join(tmp, "upstream-benchmark.mjs");
  await build({ absWorkingDir: runCopy, entryPoints: [path.join(runCopy, "src/util/benchmark.ts")], bundle: true, platform: "node", format: "esm", outfile, logLevel: "silent" });
  return import(pathToFileURL(outfile).href + "?t=" + Date.now());
}
