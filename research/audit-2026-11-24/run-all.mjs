// Runs every repro/<slug>.mjs ONE AT A TIME against a built benchmark checkout and prints `<slug> <verdict>`.
//   usage: node run-all.mjs [checkout]
//   default checkout: $AUDIT_TARGET, else the repository root two levels above this folder
//   (research/audit-2026-11-24/../..). The checkout must be built first: `node scripts/build.mjs` there.
//   ONLY=<slug>,<slug> runs a subset.
// Exit protocol of every repro: 1 only after a line starting REPRODUCED, 0 only after a line starting
// NOT REPRODUCED, 2 on anything else. An exit 1 without a REPRODUCED line, an exit 0 without a NOT
// REPRODUCED line, or a kill / other code is reported as CRASHED, never as a verdict.
// Each repro gets a 20-minute timeout with SIGKILL. Nothing is written into the repository: bundles, child
// TMPDIR and each repro's full stdout/stderr go to a fresh directory under os.tmpdir() (named in the header;
// the full path is printed on stderr).
// Process layout: this runner waits (spawnSync) on one repro; a repro waits on at most one child at a time
// (bundled probe, real worker row, or upstream's runner, which forks one worker). Nothing runs in parallel.
import { spawnSync } from "node:child_process";
import { readdirSync, mkdirSync, mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const run = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : process.env.AUDIT_TARGET ? path.resolve(process.env.AUDIT_TARGET) : path.resolve(here, "..", "..");
if (!existsSync(path.join(run, "src/util/benchmark.ts")) || !existsSync(path.join(run, "dist/index.js"))) {
  console.error(`not a built benchmark checkout: ${run} (run \`node scripts/build.mjs\` there first)`);
  process.exit(2);
}
const scratch = mkdtempSync(path.join(os.tmpdir(), "jrb-audit-run-all-"));
const outDir = path.join(scratch, "outputs");
const tmpDir = path.join(scratch, "tmpdir");
mkdirSync(outDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const load = () => os.loadavg().map((x) => x.toFixed(2)).join(" ");
let sourceCommit = "?";
try { sourceCommit = JSON.parse(readFileSync(path.join(run, "bench-results/latest.samples.json"), "utf8")).sourceCommit ?? "?"; } catch {}
let worst = 0;
console.log(`# checkout: ${path.relative(here, run) || "."} (relative to this folder)`);
console.log(`# dist/index.js sha256 ${sha(path.join(run, "dist/index.js"))}; bench-results sourceCommit ${sourceCommit}`);
console.log(`# node ${process.version}, V8 ${process.versions.v8}, ${process.platform}/${process.arch}; load average ${load()}`);
console.log(`# scratch (outside the repository): <os.tmpdir()>/${path.basename(scratch)}`);
console.error(`scratch: ${scratch}`);
console.log(`# started ${new Date().toISOString()}`);
for (const file of readdirSync(path.join(here, "repro")).filter((f) => f.endsWith(".mjs")).sort()) {
  const slug = file.slice(0, -".mjs".length);
  if (only && !only.has(slug)) continue;
  const t0 = Date.now();
  const child = spawnSync(process.execPath, [path.join(here, "repro", file), run], {
    cwd: here, encoding: "utf8", timeout: 1_200_000, killSignal: "SIGKILL", maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, TMPDIR: tmpDir, AUDIT_SCRATCH: path.join(scratch, "repro"), AUDIT_TARGET: run },
  });
  const out = child.stdout ?? "";
  writeFileSync(path.join(outDir, slug + ".txt"), `${out}\n--- stderr ---\n${child.stderr ?? ""}\n--- exit ${child.status} signal ${child.signal}\n`);
  const lines = out.split(/\r?\n/);
  const reproduced = lines.some((l) => l.startsWith("REPRODUCED"));
  const refuted = lines.some((l) => l.startsWith("NOT REPRODUCED"));
  let status = String(child.status);
  if (child.status === 1 && !reproduced) status = "CRASHED";
  else if (child.status === 0 && !refuted) status = "CRASHED";
  else if (child.status !== 0 && child.status !== 1 && child.status !== 2) status = `CRASHED (${child.signal ?? child.status})`;
  if (status.startsWith("CRASHED") || child.status === 2) worst = 2;
  console.log(`${slug} ${status}   (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
console.log(`# finished ${new Date().toISOString()}; load average ${load()}`);
console.log(`# full output of each repro: <scratch>/outputs/<slug>.txt; run-all exit ${worst}`);
process.exitCode = worst;
