// QUESTION: "Each semantic workload group has equal weight, and scenarios within a group have equal
// weight" (README.md:245-246). Groups are assigned by row-name prefix (src/util/benchmark.ts:235-245) and
// hold 1..10 scored rows, so one scenario weighs between 1.67% and 16.67% of the score: a 10x spread that
// no claim justifies per scenario. The ranking depends on that grouping.
// Evidence: published samples only (independent recompute). No timing.
import { verdict, control, PUBLISHED_SAMPLES } from "../lib/fable/repro.mjs";
import { loadSamples, score } from "../lib/fable/score.mjs";

await verdict(async () => {
  const samples = loadSamples(PUBLISHED_SAMPLES);
  const balanced = score(samples);
  const flat = score(samples, { aggregation: "flat" });
  control(balanced.ranking.length === 29 && balanced.ranking[0].framework === "reflex-quant", "independent recompute reproduces the published board (29 ranked, reflex-quant first)");
  const groupOf = (t) => balanced.facts.find((f) => f.name === t).group;
  const groups = new Map();
  for (const t of balanced.commonTests) (groups.get(groupOf(t)) ?? groups.set(groupOf(t), []).get(groupOf(t))).push(t);
  console.log("scored group | rows | weight of ONE row in the score");
  const weights = [];
  for (const [g, rows] of [...groups].sort((a, b) => a[1].length - b[1].length)) {
    const w = 100 / groups.size / rows.length;
    weights.push(w);
    console.log(`  ${g.padEnd(10)} ${String(rows.length).padStart(2)}   ${w.toFixed(2)}%${rows.length <= 3 ? "   (" + rows.join(", ") + ")" : ""}`);
  }
  // control: inside ONE group the two aggregations are the same thing
  const updateRows = groups.get("update");
  const a = score(samples, { onlyTests: updateRows }), b = score(samples, { onlyTests: updateRows, aggregation: "flat" });
  control(a.ranking.every((r, i) => r.framework === b.ranking[i].framework), "control: on a single group (update, 7 rows) balanced and flat aggregation give the same order");

  const rank = (s) => new Map(s.ranking.map((r) => [r.framework, r.rank]));
  const base = rank(balanced), alt = rank(flat);
  const moved = [...base].filter(([fw, r]) => alt.get(fw) !== r).sort((x, y) => Math.abs(alt.get(y[0]) - y[1]) - Math.abs(alt.get(x[0]) - x[1]));
  console.log(`\nflat geometric mean over the same ${balanced.commonTests.length} rows: ${moved.length} of ${base.size} ranks change`);
  for (const [fw, r] of moved.slice(0, 8)) console.log(`  ${fw}: #${r} -> #${alt.get(fw)}`);
  const at = (s, fw) => s.ranking.find((r) => r.framework === fw);
  console.log(`lite-signal: #${at(balanced, "lite-signal").rank} (${at(balanced, "lite-signal").score.toFixed(3)}) -> #${at(flat, "lite-signal").rank} (${at(flat, "lite-signal").score.toFixed(3)})`);
  console.log(`reflex-quant / alien-signals / reflex: #${["reflex-quant", "alien-signals", "reflex"].map((fw) => `${base.get(fw)}->${alt.get(fw)}`).join(", #")}`);
  const spread = Math.max(...weights) / Math.min(...weights);
  return {
    reproduced: spread >= 5 && moved.length > 0,
    summary: `one scenario weighs ${Math.min(...weights).toFixed(2)}% to ${Math.max(...weights).toFixed(2)}% of the score (${spread.toFixed(0)}x) depending on its name prefix; a flat geometric mean over the same rows changes ${moved.length} of ${base.size} ranks`,
  };
});
