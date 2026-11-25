// DEFECT (label): the `pull` group is documented as "dirty reads, aggregation, and chain pulls"
// (README.md:187, SEMANTICS.md:208). Its ONLY row, dynamic/pure pull, performs no dirty read at all on a
// lazy engine: 10000 batched writes to a graph nobody has read yet, then one first evaluation of each node.
// That single row carries 1/6 of the published score.
// Evidence: operation counts inside the timed region of the REAL row (deterministic), upstream's own
// published counters, and a re-computation of the board. No timing.
import { readFileSync } from "node:fs";
import { verdict, control, runCopy, PUBLISHED_LOG, PUBLISHED_SAMPLES } from "../lib/fable/repro.mjs";
import { buildCounted, runCounted, catalogOf } from "../lib/fable/count-harness.mjs";
import { loadSamples, score } from "../lib/fable/score.mjs";

const ROW = "dynamic/pure pull";
const show = (label, c) => console.log(`  ${label.padEnd(46)} batches=${c.batches} writes=${c.writes} sinkReads(top-level)=${c.topReads} nodesBuilt=${c.signalsCreated + c.computedsCreated} computedEvals=${c.computedEvals} firstEvals=${c.firstEvals} dirtyReEvals=${c.reEvals}`);

await verdict(async () => {
  const run = runCopy();
  const catalog = catalogOf(run);
  const entry = (id) => catalog.find((e) => e.id === id);

  console.log("timed region of the real row (pilot, 2 warm-ups and the sample are identical; the sample is shown):");
  const lazy = runCounted(await buildCounted(run, entry("alien")), `alien-signals :: ${ROW}`, { pullCounts: true });
  control(!lazy.failed && lazy.invocations.length === 4, "real row, alien-signals: validation (sum and pull count 224) passes for pilot + 2 warm-ups + 1 sample");
  const real = lazy.invocations[3];
  show("alien-signals (lazy), real row", real);

  // control: the same row, ONE step changed at build time: the sinks are read after every write
  const mixedBundle = await buildCounted(run, entry("alien"), {
    tag: "pull-as-mixed",
    substitutions: [{ file: "src/workloads.ts", from: `    name: "pure pull",\n    mode: "pull",`, to: `    name: "pure pull",\n    mode: "mixed",` }],
  });
  const mixedRun = runCounted(mixedBundle, `alien-signals :: ${ROW}`, { pullCounts: false });
  control(!mixedRun.failed && mixedRun.invocations.length === 4, "control row (mode mixed) passes the same sum validation");
  const mixed = mixedRun.invocations[3];
  show("alien-signals, control: sinks read per write", mixed);
  control(mixed.reEvals > 0 && mixed.topReads >= 10000 * 32, "the control does perform dirty re-evaluations and per-iteration sink reads");

  // the same real row on an eager engine
  const eagerRun = runCounted(await buildCounted(run, entry("s")), `s-js :: ${ROW}`, { pullCounts: false });
  control(!eagerRun.failed && eagerRun.invocations.length === 4, "real row, s-js: validation passes");
  show("s-js (eager), real row", eagerRun.invocations[3]);

  // upstream's own published counters for this row
  const published = new Map();
  for (const line of readFileSync(PUBLISHED_LOG, "utf8").split(/\r?\n/)) {
    if (!line.includes("(pure pull)")) continue;
    const fw = line.split(" , ")[0].trim();
    const rec = Number(line.match(/nodesRecomputed=(\d+)/)?.[1]);
    const sinks = Number(line.match(/sinkReads=(\d+)/)?.[1]);
    (published.get(`${rec} recomputed, ${sinks} sink reads`) ?? published.set(`${rec} recomputed, ${sinks} sink reads`, []).get(`${rec} recomputed, ${sinks} sink reads`)).push(fw);
  }
  console.log("\npublished latest.log, metrics column of this row:");
  for (const [key, list] of published) console.log(`  ${key}: ${list.length} frameworks (${list.slice(0, 6).join(", ")}${list.length > 6 ? ", ..." : ""})`);

  // the group and its weight on the published board
  const samples = loadSamples(PUBLISHED_SAMPLES);
  const s = score(samples);
  const pullRows = [...new Set(samples.rows.filter((r) => r.group === "pull").map((r) => r.name))];
  const groups = new Set(s.commonTests.map((t) => s.facts.find((f) => f.name === t).group));
  const without = score(samples, { excludeTests: [ROW] });
  const base = new Map(s.ranking.map((r) => [r.framework, r.rank]));
  const moved = without.ranking.filter((r) => base.get(r.framework) !== r.rank);
  const lite = (x) => x.ranking.find((r) => r.framework === "lite-signal");
  console.log(`\nrows in group 'pull' on the published board: ${pullRows.join(", ")}  -> weight ${(100 / groups.size).toFixed(1)}% of the score (${groups.size} groups, equal weight)`);
  console.log(`board without this row: ${moved.length} of ${base.size} ranks change (largest: ${moved.map((r) => [r.framework, base.get(r.framework), r.rank]).sort((a, b) => Math.abs(b[1] - b[2]) - Math.abs(a[1] - a[2])).slice(0, 4).map(([fw, a, b]) => `${fw} #${a}->#${b}`).join(", ")})`);
  console.log(`lite-signal: #${lite(s).rank} (${lite(s).score.toFixed(3)}) -> #${lite(without).rank} (${lite(without).score.toFixed(3)})`);

  const reproduced = real.reEvals === 0 && real.computedEvals === real.computedsCreated && real.batches === 10000 &&
    real.topReads === 32 && pullRows.length === 1 && pullRows[0] === ROW;
  return {
    reproduced,
    summary: reproduced
      ? `the only row of group 'pull' does ${real.reEvals} dirty re-evaluations on a lazy engine: ${real.batches} batched writes, ${real.topReads} sink reads, ${real.computedEvals} first evaluations of ${real.computedsCreated} nodes built inside the timed region; it weighs ${(100 / groups.size).toFixed(1)}% of the score and removing it changes ${moved.length} ranks`
      : `dirtyReEvals=${real.reEvals}, pull rows=${pullRows.join("|")}`,
  };
});
