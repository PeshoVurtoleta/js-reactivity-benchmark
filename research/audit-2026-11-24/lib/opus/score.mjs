// Independent scorer over latest.samples.json (does not import upstream code).
import { readFileSync } from "node:fs";
export function load(file) { return JSON.parse(readFileSync(file, "utf8")); }
export const suiteOf = (g) => (g === "large_graph" ? "stress" : g === "lifecycle" ? "capability" : "core");
export const gmean = (xs) => Math.exp(xs.reduce((s, x) => s + Math.log(x), 0) / xs.length);
export const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
export function status(row) {
  if (row.status === "failed") return "failed";
  if (row.capped) return "capped";
  if (row.partial) return "partial";
  return "measured";
}
// opts: estimator(row, m) -> number per machine round m (0-based); rounds: number;
// aggregate: "median"|"mean"|"pooled"; balanced: bool; capPolicy: "drop"|"ceiling"; partialPolicy: "drop"|"available"
export function score(data, opts = {}) {
  const rows = data.rows;
  const R = opts.rounds ?? 3;
  const est = opts.estimator ?? ((row, m) => row.machineEstimatesMs?.[m]);
  const capPolicy = opts.capPolicy ?? "drop";
  const balanced = opts.balanced ?? true;
  const fw = new Map();
  for (const row of rows) { if (!fw.has(row.framework)) fw.set(row.framework, []); fw.get(row.framework).push(row); }
  const tests = [...new Set(rows.map((r) => r.name))];
  const groupOf = new Map(rows.map((r) => [r.name, r.group]));
  const coreTests = tests.filter((t) => suiteOf(groupOf.get(t)) === "core" && !(opts.excludeTests ?? []).includes(t));
  const complete = [...fw.entries()].filter(([, es]) => es.some((e) => suiteOf(e.group) === "core") && es.every((e) => suiteOf(e.group) !== "core" || status(e) !== "failed")).map(([f]) => f).filter((f) => !(opts.excludeFrameworks ?? []).includes(f));
  const usable = (e) => status(e) === "measured" || (capPolicy === "ceiling" && status(e) === "capped");
  const common = coreTests.filter((t) => complete.every((f) => fw.get(f).some((e) => e.name === t && usable(e))));
  const value = (e, m) => (status(e) === "capped" ? (e.ceilingMs ?? e.machines?.find((x) => x.record?.ceilingMs)?.record.ceilingMs) : est(e, m));
  const perRound = [];
  const rounds = opts.aggregate === "pooled" ? [-1] : [...Array(R).keys()];
  for (const m of rounds) {
    const v = (e) => (m === -1 ? (status(e) === "capped" ? value(e, 0) : median([0, 1, 2].map((k) => est(e, k)))) : value(e, m));
    const best = new Map();
    for (const t of common) best.set(t, Math.min(...rows.filter((r) => r.name === t && usable(r)).map(v)));
    const s = new Map();
    for (const f of complete) {
      const es = fw.get(f).filter((e) => common.includes(e.name));
      const byGroup = new Map();
      for (const e of es) { const g = balanced ? e.group : "all"; if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g).push(v(e) / best.get(e.name)); }
      s.set(f, gmean([...byGroup.values()].map(gmean)));
    }
    perRound.push(s);
  }
  const result = complete.map((f) => {
    const vals = perRound.map((s) => s.get(f));
    const agg = opts.aggregate === "mean" ? gmean(vals) : median(vals);
    return { framework: f, score: agg, perRound: vals };
  }).sort((a, b) => a.score - b.score);
  result.forEach((r, i) => (r.rank = i + 1));
  const unranked = [...fw.keys()].filter((f) => !complete.includes(f));
  return { ranked: result, common, coreTests, unranked };
}
