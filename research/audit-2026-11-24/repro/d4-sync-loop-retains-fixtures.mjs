// DEFECT: the sample loop of one worker is fully synchronous (src/util/benchmark.ts:822-956: no await
// between invocations), so the microtask queue never runs between samples. Libraries that release nodes
// from a microtask (tansu: queueMicrotask(flushUnused); Svelte 5: batch flush) therefore keep EVERY earlier
// fixture reachable: the forced "cold" GC before each creation sample cannot collect it, although the
// harness says "Collect setup and previous-sample garbage outside the timed region" (benchmark.ts:868)
// and "earlier fixtures never keep live subscriptions into later samples" (src/cellxBench.ts:79-80).
// Evidence: live heap after a forced full GC right before each timed call, in the REAL worker path of the
// real row; control 1 = an engine without deferred release (flat); control 2 = the same worker with one
// microtask checkpoint before each sample (flat). Plus the upward drift in the published samples.
// The adapter runs WITHOUT the counting wrapper here (COUNT_PLAIN=1): only the two hooks around the timed
// statement are added, so the heap figures are the real adapter's. Memory counts, no timing. Runtime ~15 s.
import path from "node:path";
import { verdict, control, runCopy, PUBLISHED_SAMPLES } from "../lib/fable/repro.mjs";
import { buildCounted, runCounted, catalogOf } from "../lib/fable/count-harness.mjs";
import { loadSamples, score, med } from "../lib/fable/score.mjs";

const ROW = "createComputations1to1";
const MB = 1048576;

await verdict(async () => {
  const run = runCopy();
  const catalog = catalogOf(run);
  const growth = new Map();
  console.log(`live heap (MB) after a forced GC, right before each timed call of the real row '${ROW}' (pilot, 2 warm-ups, 8 samples):`);
  for (const id of ["alien", "preact", "tansu", "svelte"]) {
    const entry = catalog.find((e) => e.id === id);
    const bundle = await buildCounted(run, entry, { tag: "heap" });
    const result = {};
    for (const [label, env, nodeArgs] of [["shipped", { COUNT_HEAP: "1", COUNT_PLAIN: "1" }, []], ["checkpoint", { COUNT_HEAP: "1", COUNT_PLAIN: "1", COUNT_DRAIN: "1" }, ["--allow-natives-syntax"]]]) {
      const r = runCounted(bundle, `${entry.name} :: ${ROW}`, { env: { ...env, BENCH_SAMPLES: "8" }, nodeArgs, pullCounts: !!entry.pullCounts });
      if (r.failed || r.invocations.length !== 11) throw new Error(`${entry.name} ${label}: exit ${r.exit}, ${r.invocations.length} invocations: ${r.stderr.slice(-300)}`);
      const heap = r.invocations.map((x) => x.heapUsed / MB);
      result[label] = { heap, perInvocation: (heap.at(-1) - heap[0]) / (heap.length - 1) };
      console.log(`  ${entry.name.padEnd(24)} ${label === "shipped" ? "as shipped (synchronous loop)      " : "control: microtask checkpoint first"} ${heap.map((x) => x.toFixed(0).padStart(5)).join("")}   growth ${result[label].perInvocation.toFixed(1)} MB per invocation`);
    }
    growth.set(id, result);
  }
  control(Math.abs(growth.get("alien").shipped.perInvocation) < 5 && Math.abs(growth.get("preact").shipped.perInvocation) < 5, "control engines (alien-signals, Preact Signals): heap is flat in the shipped loop");
  control(["tansu", "svelte"].every((id) => Math.abs(growth.get(id).checkpoint.perInvocation) < 5), "control: with a microtask checkpoint before each sample the heap of tansu and Svelte is flat too");

  // Published samples: does the row get slower inside every process?
  const samples = loadSamples(PUBLISHED_SAMPLES);
  const drift = (framework) => {
    const out = [];
    for (const row of samples.rows) {
      if (row.framework !== framework || row.group !== "creation") continue;
      const ratios = [];
      for (const m of row.machines ?? []) {
        if (m.record.status === "failed" || m.record.capped) continue;
        for (const r of m.record.rounds) {
          const k = Math.floor(r.samplesMs.length / 3);
          if (k >= 3) ratios.push(med(r.samplesMs.slice(-k)) / med(r.samplesMs.slice(0, k)));
        }
      }
      if (ratios.length) out.push({ name: row.name, ratio: med(ratios), min: Math.min(...ratios), processes: ratios.length });
    }
    return out;
  };
  console.log("\npublished samples, creation rows: median(last third) / median(first third) of one process's samples (median over 9 processes; rows where EVERY process slows down are marked *):");
  const published = new Map();
  for (const fw of ["alien-signals", "Preact Signals", "@amadeus-it-group/tansu", "Svelte v5"]) {
    const d = drift(fw);
    published.set(fw, d);
    console.log(`  ${fw.padEnd(24)} ${d.map((x) => `${x.ratio.toFixed(2)}${x.min > 1 ? "*" : ""}`).join(" ")}   rows slower in every process: ${d.filter((x) => x.min > 1).length}/${d.length}`);
  }

  // Bound on the board effect: score the two frameworks' creation rows from the first third of each
  // process's samples (the least contaminated third; it still follows 3 retained fixtures).
  const base = score(samples);
  const facts = base.facts;
  const patched = structuredClone(samples);
  for (const row of patched.rows) {
    if (row.group !== "creation" || !["@amadeus-it-group/tansu", "Svelte v5"].includes(row.framework)) continue;
    for (const m of row.machines ?? []) for (const r of m.record.rounds ?? []) if (r.samplesMs) r.samplesMs = r.samplesMs.slice(0, Math.max(3, Math.floor(r.samplesMs.length / 3)));
  }
  const alt = score(patched);
  const at = (s, fw) => s.ranking.find((r) => r.framework === fw);
  console.log("\nboard if these two frameworks' creation rows were scored from the first third of each process (a lower bound of the effect):");
  for (const fw of ["@amadeus-it-group/tansu", "Svelte v5", "lite-signal"])
    console.log(`  ${fw.padEnd(24)} #${at(base, fw).rank} (${at(base, fw).score.toFixed(3)}) -> #${at(alt, fw).rank} (${at(alt, fw).score.toFixed(3)})`);
  const moved = alt.ranking.filter((r) => at(base, r.framework).rank !== r.rank).length;
  console.log(`  ranks changed: ${moved}`);

  const t = growth.get("tansu").shipped.perInvocation, s = growth.get("svelte").shipped.perInvocation;
  const reproduced = t > 50 && s > 50;
  return {
    reproduced,
    summary: reproduced
      ? `in the shipped synchronous loop tansu retains ${t.toFixed(0)} MB and Svelte v5 ${s.toFixed(0)} MB more live heap per invocation of ${ROW} (flat with a microtask checkpoint, flat for alien-signals and Preact Signals); their published creation rows slow down inside every process (${published.get("@amadeus-it-group/tansu").filter((x) => x.min > 1).length} and ${published.get("Svelte v5").filter((x) => x.min > 1).length} of 10 rows)`
      : `heap growth per invocation: tansu ${t.toFixed(1)} MB, Svelte ${s.toFixed(1)} MB`,
  };
});
