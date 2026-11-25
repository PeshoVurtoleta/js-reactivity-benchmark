// Independent re-implementation of the published score, from latest.samples.json only.
// It shares no code with upstream's scripts/render-results-page.mjs.
import { readFileSync } from "node:fs";

export const med = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
export const geo = (xs) => Math.exp(xs.reduce((a, x) => a + Math.log(x), 0) / xs.length);
export const suiteOf = (group) =>
  group === "large_graph" ? "stress" : group === "lifecycle" ? "capability" : "core";

export function loadSamples(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Per-row facts recomputed from the raw per-machine records (not from the merged fields). */
export function rowFacts(row, opts = {}) {
  const estimator = opts.estimator ?? "median-of-round-medians";
  const machines = (row.machines ?? []).map((m) => {
    const rec = m.record;
    const failed = rec.status === "failed";
    const capped = rec.capped === true;
    let estimate;
    if (!failed && !capped) {
      const rounds = rec.rounds.map((r) => r.samplesMs);
      if (estimator === "median-of-round-medians") estimate = med(rounds.map(med));
      else if (estimator === "min-of-round-mins") estimate = Math.min(...rounds.map((r) => Math.min(...r)));
      else if (estimator === "median-of-round-mins") estimate = med(rounds.map((r) => Math.min(...r)));
      else if (estimator === "pooled-median") estimate = med(rounds.flat());
      else if (estimator === "mean-of-round-means") estimate = rounds.map((r) => r.reduce((a, b) => a + b, 0) / r.length).reduce((a, b) => a + b, 0) / rounds.length;
      else if (estimator === "median-of-round-last-half-medians") estimate = med(rounds.map((r) => med(r.slice(Math.floor(r.length / 2)))));
      else throw new Error("unknown estimator " + estimator);
    }
    return { machineRound: m.machineRound, failed, capped, estimate, ceilingMs: rec.ceilingMs, record: rec };
  });
  const failed = machines.some((m) => m.failed);
  const measured = machines.filter((m) => !m.failed && !m.capped);
  const capped = !failed && measured.length === 0;
  const partial = !failed && measured.length > 0 && measured.length < machines.length;
  return {
    id: row.id, framework: row.framework, name: row.name, group: row.group,
    suite: suiteOf(row.group), failed, capped, partial, machines,
    byRound: new Map(measured.map((m) => [m.machineRound, m.estimate])),
  };
}

/**
 * opts.estimator: see rowFacts. opts.aggregation: "balanced" (upstream) | "flat".
 * opts.capHandling: "drop-scenario" (upstream) | "drop-framework-row" | "ceiling-as-time".
 * opts.reference: "best" (upstream) | "median" (ratio to the per-round median of measured rows).
 * opts.excludeTests / opts.onlyTests: scenario name filters.
 */
export function score(samples, opts = {}) {
  const aggregation = opts.aggregation ?? "balanced";
  const capHandling = opts.capHandling ?? "drop-scenario";
  const reference = opts.reference ?? "best";
  const facts = samples.rows.map((r) => rowFacts(r, opts));
  const rounds = [...new Set(samples.machines.map((m) => m.machineRound))].sort((a, b) => a - b);
  const frameworks = [...new Set(facts.map((f) => f.framework))];
  const tests = [...new Set(facts.map((f) => f.name))];
  const byKey = new Map(facts.map((f) => [f.framework + "\u0000" + f.name, f]));
  const coreTests = tests.filter((t) => facts.find((f) => f.name === t).suite === "core")
    .filter((t) => !(opts.excludeTests ?? []).includes(t))
    .filter((t) => !opts.onlyTests || opts.onlyTests.includes(t));
  const complete = frameworks.filter((fw) => {
    const mine = facts.filter((f) => f.framework === fw && f.suite === "core");
    return mine.length > 0 && mine.every((f) => !f.failed);
  });
  const full = (f) => f && !f.failed && !f.capped && !f.partial;
  const commonTests = coreTests.filter((t) =>
    capHandling === "drop-scenario"
      ? complete.every((fw) => full(byKey.get(fw + "\u0000" + t)))
      : true);
  // reference per round and test over every fully measured row (ranked or not), as upstream does
  const refOf = new Map();
  for (const r of rounds) for (const t of tests) {
    const vals = facts.filter((f) => f.name === t && full(f)).map((f) => f.byRound.get(r));
    if (vals.length) refOf.set(r + "\u0000" + t, reference === "best" ? Math.min(...vals) : med(vals));
  }
  const result = [];
  for (const fw of complete) {
    const perRound = [];
    for (const r of rounds) {
      const groups = new Map();
      const flat = [];
      for (const t of commonTests) {
        const f = byKey.get(fw + "\u0000" + t);
        let time;
        if (full(f)) time = f.byRound.get(r);
        else if (capHandling === "ceiling-as-time" && f && !f.failed) {
          const m = f.machines.find((x) => x.machineRound === r);
          time = m.capped ? m.ceilingMs : m.estimate;
        } else continue; // drop-framework-row
        const ratio = time / refOf.get(r + "\u0000" + t);
        flat.push(ratio);
        (groups.get(f.group) ?? groups.set(f.group, []).get(f.group)).push(ratio);
      }
      perRound.push(aggregation === "balanced" ? geo([...groups.values()].map(geo)) : geo(flat));
    }
    result.push({ framework: fw, score: med(perRound), perRound });
  }
  result.sort((a, b) => a.score - b.score);
  result.forEach((r, i) => (r.rank = i + 1));
  return {
    ranking: result, commonTests, coreTests, complete,
    unranked: frameworks.filter((fw) => !complete.includes(fw)),
    excludedCore: coreTests.filter((t) => !commonTests.includes(t)),
    facts, rounds,
  };
}
