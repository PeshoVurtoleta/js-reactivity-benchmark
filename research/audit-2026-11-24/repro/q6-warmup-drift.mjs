// QUESTION: 2 warm-up invocations do not warm short rows; their measured samples are a JIT warm-up
// transient, and the adaptive sample count (6..100) decides how far into it each engine is read.
// Evidence: the chronological samples upstream publishes (latest.samples.json). No timing here.
import { verdict, control, PUBLISHED_SAMPLES } from "../lib/fable/repro.mjs";
import { loadSamples, score, med, suiteOf } from "../lib/fable/score.mjs";

await verdict(async () => {
  const samples = loadSamples(PUBLISHED_SAMPLES);
  const perScenario = new Map();
  for (const row of samples.rows) for (const m of row.machines ?? []) {
    const rec = m.record;
    if (rec.status === "failed" || rec.capped) continue;
    for (const r of rec.rounds) {
      const s = r.samplesMs;
      const e = perScenario.get(row.name) ?? perScenario.set(row.name, { group: row.group, halves: [], first10: [], bias: [], n: [], time: [] }).get(row.name);
      const half = Math.floor(s.length / 2);
      e.n.push(s.length);
      e.time.push(med(s));
      e.halves.push(med(s.slice(0, half)) / med(s.slice(-half))); // every sequence has >= 6 samples
      if (s.length >= 40) e.first10.push(med(s.slice(0, 10)) / med(s));
      // bias of the published per-process estimate (median of ALL samples) against the level the process
      // has reached in its last quarter; needs >= 20 samples so that a quarter has >= 5
      if (s.length >= 20) e.bias.push(med(s) / med(s.slice(-Math.floor(s.length / 4))));
    }
  }
  const table = [...perScenario].map(([name, e]) => ({
    name, group: e.group, suite: suiteOf(e.group), sequences: e.halves.length, timeMs: med(e.time),
    halves: med(e.halves), shareDrifting: e.halves.filter((x) => x > 1.05).length / e.halves.length,
    first10: e.first10.length >= 30 ? med(e.first10) : undefined, nMin: Math.min(...e.n), nMax: Math.max(...e.n),
    bias: e.bias.length >= 30 ? med(e.bias) : undefined,
    biasShare: e.bias.length >= 30 ? e.bias.filter((x) => x > 1.05).length / e.bias.length : undefined,
  })).sort((a, b) => (b.bias ?? 0) - (a.bias ?? 0) || b.halves - a.halves);
  console.log("scenario | group | median sample ms | sequences | A: median(all)/median(last quarter) [n>=20] | share of sequences with A>1.05 | B: median(first half)/median(second half) | C: median(first 10)/median(all) [n>=40] | samples per sequence");
  const f = (x) => (x === undefined ? "  -  " : x.toFixed(3));
  for (const t of table) console.log(`  ${t.name.padEnd(44)} | ${t.group.padEnd(11)} | ${t.timeMs.toFixed(3).padStart(8)} | ${String(t.sequences).padStart(3)} | ${f(t.bias)} | ${t.biasShare === undefined ? "  - " : (100 * t.biasShare).toFixed(0).padStart(3) + "%"} | ${t.halves.toFixed(3)} | ${f(t.first10)} | ${t.nMin}..${t.nMax}`);

  // no-fault control: the update rows (13-24 ms per sample: 1e4..4e5 writes each) are warm after
  // pilot + 2 warm-ups, so the same statistic must sit at 1 for them
  const update = table.filter((t) => t.name.startsWith("updateComputations"));
  control(update.length === 7 && update.every((t) => Math.abs(t.halves - 1) < 0.03),
    `the 7 update rows have first-half/second-half within 3% of 1 (${update.map((t) => t.halves.toFixed(3)).join(", ")})`);

  // a row counts when the published estimator sits more than 5% above the process's own late level
  const drifting = table.filter((t) => t.bias !== undefined && t.bias >= 1.05);
  const s = score(samples);
  const scored = drifting.filter((t) => s.commonTests.includes(t.name));
  const groups = new Map();
  for (const t of s.commonTests) { const g = s.facts.find((f) => f.name === t).group; groups.set(g, (groups.get(g) ?? 0) + 1); }
  const weight = scored.reduce((sum, t) => sum + 1 / groups.size / groups.get(t.group), 0);
  console.log(`\nrows whose published per-process estimate is >= 1.05x the level of the process's last quarter: ${drifting.length} (${scored.length} of them among the ${s.commonTests.length} scored core scenarios)`);
  console.log(`  scored: ${scored.map((t) => `${t.name} ${t.bias.toFixed(2)}`).join(", ")}`);
  console.log(`  their weight in the family-balanced score: ${(100 * weight).toFixed(1)}%`);

  // what a steadier estimator does to the board (still from the published samples)
  const late = score(samples, { estimator: "median-of-round-last-half-medians" });
  const base = new Map(s.ranking.map((r) => [r.framework, r.rank]));
  const moved = late.ranking.filter((r) => base.get(r.framework) !== r.rank);
  console.log(`\nestimator 'median of the last half of each process' instead of 'median of all samples': ${moved.length} ranks change: ${moved.map((r) => `${r.framework} #${base.get(r.framework)}->#${r.rank}`).join(", ")}`);
  const lite = (x) => x.ranking.find((r) => r.framework === "lite-signal");
  console.log(`lite-signal: #${lite(s).rank} (${lite(s).score.toFixed(3)}) -> #${lite(late).rank} (${lite(late).score.toFixed(3)})`);

  return {
    reproduced: scored.length >= 1,
    summary: scored.length
      ? `${scored.length} scored core rows (${(100 * weight).toFixed(1)}% of the score weight) are sampled while still speeding up: the published estimate is ${Math.min(...scored.map((t) => t.bias)).toFixed(2)}x-${Math.max(...scored.map((t) => t.bias)).toFixed(2)}x the level of the process's own last quarter; the 7 long update rows sit at 1.00x`
      : "no scored core row has a published estimate 5% above its late level",
  };
});
