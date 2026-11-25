// Bundles a TypeScript entry (resolved inside <runCopy>/src) with the SAME esbuild options as upstream's
// scripts/build.mjs:18-33 (cjs, conditions production+module, tree shaking, whitespace minification,
// module aliases, NODE_ENV define + banner). `extraDefine` adds defines for a control build.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { TMP } from "./repro.mjs";

export async function plainBuild(runCopy, name, contents, extraDefine = {}) {
  mkdirSync(TMP, { recursive: true });
  const require = createRequire(path.join(runCopy, "package.json"));
  const { build } = require("esbuild");
  const { moduleAliases } = await import(pathToFileURL(path.join(runCopy, "scripts/module-aliases.mjs")).href);
  const outfile = path.join(TMP, `${name}.cjs`);
  await build({
    absWorkingDir: runCopy, bundle: true, platform: "node", target: "node22", format: "cjs",
    conditions: ["production", "module"], treeShaking: true, minifyWhitespace: true, alias: moduleAliases,
    define: { "process.env.NODE_ENV": '"production"', ...extraDefine },
    banner: { js: 'process.env.NODE_ENV = "production";' },
    outfile, logLevel: "silent",
    stdin: { loader: "ts", resolveDir: path.join(runCopy, "src"), sourcefile: `${name}.ts`, contents },
  });
  return outfile;
}

/** The worker entry upstream generates for one adapter (scripts/build.mjs), without any wrapper. */
export const workerEntry = (module, exportName, pullCounts) => `
import { ${exportName} as framework } from "./frameworks/${module}";
import { registerFrameworkBenchmarks } from "./suite";
import { runBenchmarks } from "./util/benchmark";
registerFrameworkBenchmarks({ framework, testPullCounts: ${pullCounts ? "true" : "false"} });
runBenchmarks().catch((error) => { console.error(error); process.exitCode = 1; });
`;
