// repro-rank-sensitivity: the page marks only ranks 5 and 6 with '~' (paired machine-round scores cross,
// render-results-page.mjs:686-696). Re-scoring the SAME published samples with other defensible per-row
// estimators (per-process mean, min, second-half median) or aggregation (pooled machines, mean of rounds)
// reorders ranks 4-9 beyond what the '~' marks show. Control: ranks 1-3 and 10-13 do not move.
import { main, samples } from "../lib/opus/common.mjs";
import { score, median } from "../lib/opus/score.mjs";
main(async () => {
  const d = samples();
  const stat = (fn) => (row, m) => { const rec = row.machines?.find((x) => x.machineRound === m + 1)?.record; return rec?.rounds?.length ? median(rec.rounds.map((r) => fn(r.samplesMs))) : row.machineEstimatesMs?.[m]; };
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const V = { published: {}, mean: { estimator: stat(mean) }, min: { estimator: stat((x) => Math.min(...x)) }, secondHalf: { estimator: stat((x) => median(x.slice(Math.floor(x.length / 2)))) }, pooled: { aggregate: "pooled" }, roundMean: { aggregate: "mean" } };
  const res = Object.fromEntries(Object.entries(V).map(([k, o]) => [k, score(d, o)]));
  const base = res.published.ranked;
  const span = (f) => { const rs = Object.values(res).map((r) => r.ranked.find((x) => x.framework === f).rank); return [Math.min(...rs), Math.max(...rs)]; };
  const mid = base.filter((x) => x.rank >= 4 && x.rank <= 9).map((x) => `${x.framework} ${span(x.framework).join("-")}`);
  const stable = base.filter((x) => x.rank <= 3 || (x.rank >= 10 && x.rank <= 13)).every((x) => { const [a, b] = span(x.framework); return a === b; });
  if (!stable) throw new Error("control failed: ranks 1-3/10-13 moved");
  const unmarkedSwaps = base.filter((x) => x.rank >= 4 && x.rank <= 9 && span(x.framework)[1] - span(x.framework)[0] >= 2).length;
  return { reproduced: unmarkedSwaps >= 2, line: `rank span over ${Object.keys(V).length} scorings (ranks 4-9): ${mid.join("; ")}; ranks 1-3 and 10-13 fixed (control).` };
});
