// repro-stack-depth: dalien-signals is unranked for ONE failed core row, cellx2500, kind stack-overflow
// (published samples). The worker's heap is fixed for fairness (src/util/benchmark.ts:258-263, --max-old-space-size),
// but its stack is the host default, so a 2500-layer recursive pull fails or passes by platform. Runs the built
// target checkout's REAL runner + worker (dist/) for cellx2500: default stack vs --stack-size=3000 (one flag differs).
// Control: alien-signals passes with the default stack. Then re-scores the published samples with dalien's
// cellx2500 treated like a censored row (dropped for everyone) to show the rank consequence. Runtime ~1-2 min.
import { existsSync } from "node:fs";
import path from "node:path";
import { main, runPath, runChild, samples, SCRATCH } from "../lib/opus/common.mjs";
import { score } from "../lib/opus/score.mjs";
main(async () => {
  const run = runPath();
  const dist = path.join(run, "dist/index.js");
  if (!existsSync(dist)) throw new Error("target checkout not built (node scripts/build.mjs)");
  const row = (fw, extra = []) => {
    const r = runChild(dist, { timeoutMs: 300000, args: [], env: { BENCH_FRAMEWORK: fw, BENCH_FILTER: "cellx2500", BENCH_SAMPLES: "1", BENCH_ALLOW_FAILURES: "1", BENCH_MIN_CEILING_MS: "1e9", BENCH_SAMPLES_FILE: path.join(SCRATCH, "tmp", "stack.json") }, nodeArgs: extra });
    const line = r.stdout.split("\n").find((l) => l.includes("cellx2500")) ?? "";
    return line.includes("FAILED") ? (line.match(/kind=(\S+)/)?.[1] ?? "failed") : line.includes("samples=") ? "passed" : "missing";
  };
  const ctl = row("alien-signals");
  if (ctl !== "passed") throw new Error("control failed: alien-signals " + ctl);
  const dDefault = row("dalien-signals"), dBig = row("dalien-signals", ["--stack-size=3000"]);
  const mDefault = row("MobX"), mBig = row("MobX", ["--stack-size=3000"]);
  const d = samples();
  const pub = d.rows.find((r) => r.framework === "dalien-signals" && r.name === "cellx2500");
  const cf = { ...d, rows: d.rows.map((r) => (r === pub ? { ...r, status: undefined, capped: true } : r)) };
  const ranked = score(cf).ranked, base = score(d).ranked;
  const rk = (rs, f) => rs.find((x) => x.framework === f)?.rank ?? "unranked";
  return {
    reproduced: pub?.failure?.kind === "stack-overflow" && dDefault === "stack-overflow" && dBig === "passed",
    line: `published: dalien cellx2500 = ${pub?.failure?.kind}; this host (${process.platform}/${process.arch} ${process.version}): dalien default=${dDefault}, --stack-size=3000=${dBig}; MobX default=${mDefault}, --stack-size=3000=${mBig} (published linux/x64: MobX measured); control alien-signals=${ctl}. If dalien's row were treated as censored: dalien ${rk(base, "dalien-signals")}->${rk(ranked, "dalien-signals")}, lite-signal ${rk(base, "lite-signal")}->${rk(ranked, "lite-signal")}.`,
  };
});
