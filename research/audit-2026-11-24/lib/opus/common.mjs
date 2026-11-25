// Shared helpers for repro-*.mjs. Untimed: bundles probes with the target checkout's own esbuild and runs them
// in a child node process with a timeout (SIGKILL). Never writes into the target checkout.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { AUDIT_DIR, SCRATCH_ROOT, defaultTarget } from "../scratch.mjs";

// lib/opus/../.. = this folder (A). B (published results, docs, src/) = the target checkout: argv[2], else
// $AUDIT_TARGET, else the repository root two levels above this folder (lib/scratch.mjs).
// Scratch goes to <os.tmpdir() scratch>/opus, outside the repository.
export const A = AUDIT_DIR;
const DEFAULT_RUN = defaultTarget();
export const SCRATCH = path.join(SCRATCH_ROOT, "opus");
export const B = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : DEFAULT_RUN;
export function runPath() {
  const arg = process.argv[2];
  const p = arg ? path.resolve(process.cwd(), arg) : DEFAULT_RUN;
  if (!existsSync(path.join(p, "src/util/benchmark.ts"))) throw new Error(`not a benchmark checkout: ${p}`);
  return p;
}
export function scratch(slug) {
  const dir = path.join(SCRATCH, "repro-tmp", slug);
  mkdirSync(dir, { recursive: true });
  return dir;
}
/** Bundle a TS/JS entry (which may import from the target checkout via the RUN placeholder) into a CJS file. */
export async function bundle(run, slug, name, source) {
  const dir = scratch(slug);
  const entry = path.join(dir, name + ".ts");
  writeFileSync(entry, source.replaceAll("@RUN@", run.replaceAll("\\", "/")));
  const { build } = await import(path.join(run, "node_modules/esbuild/lib/main.js"));
  const { moduleAliases } = await import(path.join(run, "scripts/module-aliases.mjs"));
  const outfile = path.join(dir, name + ".cjs");
  await build({
    absWorkingDir: run, entryPoints: [entry], outfile, bundle: true, platform: "node", target: "node22",
    format: "cjs", logLevel: "error", conditions: ["production", "module"], alias: moduleAliases,
    define: { "process.env.NODE_ENV": '"production"' }, banner: { js: 'process.env.NODE_ENV = "production";' },
  });
  return outfile;
}
export function runChild(file, { env = {}, timeoutMs = 120000, args = [], nodeArgs = [] } = {}) {
  const tmp = path.join(SCRATCH, "tmp");
  mkdirSync(tmp, { recursive: true });
  const r = spawnSync(process.execPath, ["--expose-gc", ...nodeArgs, file, ...args], {
    env: { ...process.env, TMPDIR: tmp, ...env }, encoding: "utf8", timeout: timeoutMs, killSignal: "SIGKILL", maxBuffer: 64 << 20,
  });
  if (r.error) throw r.error;
  return { status: r.status, signal: r.signal, stdout: r.stdout, stderr: r.stderr };
}
export function samples() { return JSON.parse(readFileSync(path.join(B, "bench-results/latest.samples.json"), "utf8")); }
/** Standard verdict wrapper: body returns {reproduced:boolean, line:string}; any throw exits 2. */
export async function main(body) {
  try {
    const { reproduced, line } = await body();
    if (reproduced) { console.log("REPRODUCED " + line); process.exit(1); }
    console.log("NOT REPRODUCED " + line); process.exit(0);
  } catch (e) {
    console.log("ERROR " + (e?.stack ?? e));
    process.exit(2);
  }
}

/**
 * Bundle upstream's REAL suite + runner with a framework module, patching only one line of
 * src/util/benchmark.ts in the bundle (never on disk): globalThis.__timed is true exactly while
 * entry.benchmark(fixture) runs, so a counting engine can attribute work to the timed region.
 * `patches` maps a run-relative file to [from, to] text replacements (for one-step controls).
 */
export async function bundleSuite(run, slug, name, frameworkImport, { pullCounts = false, patches = {} } = {}) {
  const dir = scratch(slug);
  const { readFileSync: rf, writeFileSync: wf } = await import("node:fs");
  const entry = path.join(dir, name + ".ts");
  wf(entry, `import { mockFramework as framework } from "${frameworkImport}";
import { registerFrameworkBenchmarks } from "${run}/src/suite";
import { runBenchmarks } from "${run}/src/util/benchmark";
registerFrameworkBenchmarks({ framework, testPullCounts: ${pullCounts} });
runBenchmarks().catch((e) => { console.error(e); process.exitCode = 1; });
`);
  const allPatches = { "src/util/benchmark.ts": [["result = entry.benchmark(fixture);", "(globalThis as any).__timed = true; (globalThis as any).__mockCounts && (globalThis as any).__mockCounts.timedInvocations++; try { result = entry.benchmark(fixture); } finally { (globalThis as any).__timed = false; }"]] };
  for (const [file, list] of Object.entries(patches)) allPatches[file] = [...(allPatches[file] ?? []), ...list];
  const plugin = { name: "audit-patch", setup(b) {
    b.onLoad({ filter: /\.ts$/ }, (args) => {
      const rel = path.relative(run, args.path).split(path.sep).join("/");
      if (!allPatches[rel]) return undefined;
      let text = rf(args.path, "utf8");
      for (const [from, to] of allPatches[rel]) { if (!text.includes(from)) throw new Error(`patch anchor not found in ${rel}: ${from}`); text = text.replace(from, to); }
      return { contents: text, loader: "ts" };
    });
  } };
  const { build } = await import(path.join(run, "node_modules/esbuild/lib/main.js"));
  const outfile = path.join(dir, name + ".cjs");
  await build({ absWorkingDir: run, entryPoints: [entry], outfile, bundle: true, platform: "node", target: "node22", format: "cjs",
    logLevel: "error", plugins: [plugin], define: { "process.env.NODE_ENV": '"production"' } });
  return outfile;
}
/** Run one registered case of a bundled suite in-process (worker mode, no parent) and return the mock counters. */
export function runCase(file, caseId, env = {}) {
  const r = runChild(file, { timeoutMs: 300000, env: { BENCH_CASE: caseId, BENCH_SAMPLES: "1", BENCH_MIN_CEILING_MS: "1e9", BENCH_ALLOW_FAILURES: "1", BENCH_SAMPLES_FILE: "", ...env },
    args: [] });
  return r;
}
