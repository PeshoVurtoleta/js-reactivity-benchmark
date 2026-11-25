// DEFECT: "Adapters measure each library's reactive core, built as it ships to production"
// (SEMANTICS.md:59; README.md:24 "bundled with NODE_ENV=production"). The build defines only
// process.env.NODE_ENV (scripts/build.mjs:27). Angular does not read NODE_ENV: its development code is
// guarded by the global `ngDevMode`, which the Angular CLI defines as false in production builds. Left
// undefined, `typeof ngDevMode === "undefined" || ngDevMode` is TRUE, so the worker runs Angular's
// development paths: initNgDevMode() installs the global and every signal()/computed() then gets an
// extra per-node toString closure and a debugName store.
// Evidence: runtime state of the adapter bundle built with upstream's options; control = the same bundle
// with ngDevMode defined false. No timing.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { verdict, control, runCopy, TMP } from "../lib/fable/repro.mjs";
import { plainBuild } from "../lib/fable/plain-build.mjs";

const ENTRY = `
import { angularFramework as fw } from "./frameworks/angularSignals";
import { signal, computed } from "@angular/core";
const g: any = globalThis;
const before = typeof g.ngDevMode;
const s = fw.signal(1);
const c = fw.computed(() => (s.read() as number) + 1);
const value = c.read();
const raw = signal(1);
const rawComputed = computed(() => raw() + 1);
console.log("NGPROBE " + JSON.stringify({
  before, after: typeof g.ngDevMode, devModeOn: !!g.ngDevMode, value,
  signalOwnToString: Object.prototype.hasOwnProperty.call(raw, "toString"),
  computedOwnToString: Object.prototype.hasOwnProperty.call(rawComputed, "toString"),
  ownKeysPerSignal: Object.getOwnPropertyNames(raw).filter((k) => !["length", "name", "prototype"].includes(k)).sort(),
}));
`;
const probe = (bundle) => {
  const child = spawnSync(process.execPath, [bundle], { cwd: TMP, env: { ...process.env, TMPDIR: TMP, NODE_ENV: "development" }, encoding: "utf8", timeout: 60_000, killSignal: "SIGKILL" });
  const line = (child.stdout ?? "").split(/\r?\n/).find((l) => l.startsWith("NGPROBE "));
  if (!line) throw new Error(`probe failed (exit ${child.status}): ${(child.stderr ?? "").slice(-400)}`);
  return JSON.parse(line.slice(8));
};

await verdict(async () => {
  const run = runCopy();
  const shippedWorker = path.join(run, "dist/workers/angular.cjs");
  const text = readFileSync(shippedWorker, "utf8");
  const devGuards = text.split('typeof ngDevMode==="undefined"||ngDevMode').length - 1;
  const version = JSON.parse(readFileSync(path.join(run, "node_modules/@angular/core/package.json"), "utf8")).version;
  console.log(`worker built by upstream's own build script: ${shippedWorker}`);
  console.log(`  @angular/core ${version}; live development guards 'typeof ngDevMode==="undefined"||ngDevMode' in the worker: ${devGuards}`);
  // The worker the target checkout really ships: run one real row and look at the global at exit.
  const preload = path.join(TMP, "ng-preload.cjs");
  writeFileSync(preload, 'process.on("exit", () => { process.stderr.write("NGDEV " + typeof globalThis.ngDevMode + " " + !!globalThis.ngDevMode + "\\n"); });\n');
  const shipped = spawnSync(process.execPath, ["--expose-gc", "-r", preload, shippedWorker], {
    cwd: TMP, encoding: "utf8", timeout: 120_000, killSignal: "SIGKILL",
    env: { ...process.env, TMPDIR: TMP, BENCH_CASE: "@angular/signals :: createDataSignals", BENCH_SAMPLES: "1", BENCH_PROFILE: "quick", BENCH_ROUNDS: "1", BENCH_IN_PROCESS: "", BENCH_FILTER: "", BENCH_SHARD: "", BENCH_SAMPLES_FILE: "" },
  });
  const shippedLine = (shipped.stderr ?? "").split(/\r?\n/).find((l) => l.startsWith("NGDEV "));
  if (!shippedLine) throw new Error(`shipped worker gave no NGDEV line (exit ${shipped.status}): ${(shipped.stderr ?? "").slice(-300)}`);
  const shippedDev = shippedLine === "NGDEV object true";
  console.log(`  after one real row (createDataSignals) in that worker: typeof globalThis.ngDevMode / truthy = ${shippedLine.slice(6)}`);
  console.log("mechanism, shown on a two-node bundle built with the options of base/scripts/build.mjs:18-33:");
  const real = probe(await plainBuild(run, "ng-real", ENTRY));
  const prod = probe(await plainBuild(run, "ng-prod", ENTRY, { ngDevMode: "false" }));
  console.log("build | typeof ngDevMode before / after first node | dev mode on | signal has own toString closure | computed has own toString | own properties per signal");
  const fmt = (r) => `${r.before} / ${r.after} | ${r.devModeOn} | ${r.signalOwnToString} | ${r.computedOwnToString} | ${r.ownKeysPerSignal.join(",")}`;
  console.log(`  upstream options (scripts/build.mjs)   | ${fmt(real)}`);
  console.log(`  control: + define ngDevMode=false      | ${fmt(prod)}`);
  control(real.value === 2 && prod.value === 2, "both builds compute the same value");
  control(!prod.devModeOn && !prod.signalOwnToString && !prod.computedOwnToString, "control build: Angular production paths (no dev global, no per-node debug closure)");
  const reproduced = shippedDev && devGuards > 0;
  return {
    reproduced,
    summary: reproduced
      ? `the shipped Angular worker runs in development mode (${devGuards} live dev guards, global ngDevMode is a truthy object after a real row); in that mode every signal and computed gets an own toString closure (control with ngDevMode=false: none)`
      : `the shipped Angular worker runs production paths (${devGuards} live dev guards, ngDevMode ${shippedLine.slice(6)})`,
  };
});
