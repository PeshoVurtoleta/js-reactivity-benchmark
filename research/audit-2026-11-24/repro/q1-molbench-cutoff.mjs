// repro-molbench-cutoff: molBench's D mutates one fixed array in place and returns the SAME reference
// (src/molBench.ts:37-43). With an Object.is cut-off, F (molBench.ts:47) and its effect (molBench.ts:53)
// never run in the timed region, so the row's fib(16) work differs by engine according to its equality
// policy, and validation cannot see a frozen F (F's expected value is constant: expectedMol, molBench.ts:21).
// Control (one step differs): D returns a fresh array (the pre-d4c5ffc form) -> F runs for every engine.
// Untimed: counts evaluations only.
import { readFileSync } from "node:fs";
import path from "node:path";
import { main, runPath, bundle, runChild, SCRATCH } from "../lib/opus/common.mjs";

const PROBE = (moduleRel) => `
import { frameworkInfo } from "@RUN@/src/config";
import { molWorkload } from "${moduleRel}";
const want = new Set(["alien-signals","lite-signal","s-js","uSignal","rescript-signals","@amadeus-it-group/tansu"]);
const out: any = {};
for (const { framework: fw } of frameworkInfo) {
  if (!want.has(fw.name)) continue;
  for (const freezeF of [false, true]) {
    const counts: number[] = []; let created = 0; let timed = false;
    const w: any = Object.create(fw);
    w.computed = (fn: any) => { const i = created++; counts[i] = 0; let cached: any; let first = true;
      return fw.computed(() => { if (timed) counts[i]++; if (freezeF && i === 3) { if (first) { first = false; cached = fn(); } return cached; } return fn(); }); };
    w.effect = (fn: any) => { const i = created++; counts[i] = 0; return (fw.effect as any).call(w, () => { if (timed) counts[i]++; return fn(); }); };
    fw.resetBenchmark?.();
    let valid = "passed";
    try {
      const fx = molWorkload(w); timed = true; const r = fx.run(); timed = false;
      try { fx.validate(r); } catch (e: any) { valid = "FAILED " + e.message; }
      fx.dispose();
    } catch (e: any) { timed = false; valid = "FAILED(setup) " + e.message; }
    out[fw.name + (freezeF ? " [F frozen]" : "")] = { f: counts[3], effectF: counts[7], valid };
  }
}
console.log(JSON.stringify(out));
`;

main(async () => {
  const run = runPath();
  const src = readFileSync(path.join(run, "src/molBench.ts"), "utf8");
  const fixedArray = /const items = Array\.from\(\{ length: 5 \}, \(_, i\) => \(\{ x: i \}\)\);\s*const d = framework\.computed\(\(\) => \{\s*const av = a\.read\(\) % 2,\s*bv = b\.read\(\) % 2;\s*for \(let i = 0; i < items\.length; i\+\+\) items\[i\]\.x = i \+ av - bv;\s*return items;\s*\}\);/;
  const inPlace = fixedArray.test(src); // false on a patched tree: then only the behaviour of the current row is judged
  const control = src.replace(fixedArray, `const d = framework.computed(() => { const av = a.read() % 2, bv = b.read() % 2; return Array.from({ length: 5 }, (_, i) => ({ x: i + av - bv })); });`)
    .replaceAll('from "./util/', `from "${run}/src/util/`);
  const ctlDir = path.join(SCRATCH, "repro-tmp", "molbench-cutoff");
  (await import("node:fs")).mkdirSync(ctlDir, { recursive: true });
  (await import("node:fs")).writeFileSync(path.join(ctlDir, "molBenchFresh.ts"), control);
  const cur = await bundle(run, "molbench-cutoff", "probe-current", PROBE("@RUN@/src/molBench"));
  const ctl = await bundle(run, "molbench-cutoff", "probe-control", PROBE(path.join(ctlDir, "molBenchFresh.ts")));
  const a = JSON.parse(runChild(cur).stdout.trim().split("\n").pop());
  const b = inPlace ? JSON.parse(runChild(ctl).stdout.trim().split("\n").pop()) : a;
  const fmt = (o) => Object.entries(o).map(([k, v]) => `${k}: F=${v.f} effF=${v.effectF} ${v.valid}`).join("; ");
  console.log("current (in-place D):", fmt(a));
  console.log(inPlace ? "control (fresh D):    " + fmt(b) : "control: in-place D not present (patched tree); judging current behaviour only");
  if (!Object.values(b).every((v) => v.valid === "passed" || v.valid.startsWith("FAILED"))) throw new Error("control probe malformed");
  if (inPlace && b["alien-signals"].f < 1) throw new Error("control failed: fresh D should make F run for alien-signals");
  const cutoffSkips = a["alien-signals"].f === 0 && a["lite-signal"].f === 0;
  const nonCutoffPays = a["s-js"].f > 0 && a["uSignal"].f > 0;
  const frozenPasses = a["alien-signals [F frozen]"].valid === "passed" && a["s-js [F frozen]"].valid === "passed";
  const reproduced = (cutoffSkips && nonCutoffPays) || frozenPasses;
  return {
    reproduced,
    line: `molBench: F evaluations per timed run = ${a["alien-signals"].f} for alien-signals, ${a["lite-signal"].f} for lite-signal, ${a["s-js"].f} for s-js, ${a["uSignal"].f} for uSignal (control with fresh D: alien-signals F=${inPlace ? b["alien-signals"].f : "n/a"}); a frozen F passes molBench validation (alien: ${a["alien-signals [F frozen]"].valid}, s-js: ${a["s-js [F frozen]"].valid}).`,
  };
});
