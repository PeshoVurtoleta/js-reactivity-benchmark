// Independent re-derivation (published samples only, untimed) of three neon-only statements, plus the
// opus FACT 16 / neon F12.1 contradiction. Not a protocol repro: it prints numbers and exits 0, or 2 on error.
//   usage: node checks/check-neon-published.mjs [checkout]   (default: the repository root two levels above this folder)
// (a) neon F3: share of published rounds (n >= 10) whose samplesMs[0] > 1.5 x median(second half), by gcMode;
//     share whose first-half median > 1.1 x second-half median.
// (b) neon F12.1 vs opus FACT 16: rank change when unranked frameworks may not set the per-round best.
// (c) neon F3: rows that hit the 100-sample cap, and their total measured time per process.
import path from "node:path";
import { loadSamples, score, med } from "../lib/fable/score.mjs";
import { defaultTarget } from "../lib/scratch.mjs";

try {
  const run = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultTarget();
  const s = loadSamples(path.join(run, "bench-results/latest.samples.json"));

  // (a)
  const tally = new Map();
  for (const row of s.rows) for (const m of row.machines ?? []) {
    const rec = m.record;
    if (rec.status === "failed" || rec.capped) continue;
    for (const r of rec.rounds ?? []) {
      const x = r.samplesMs;
      if (!x || x.length < 10) continue;
      const mode = row.gcMode ?? "?";
      const t = tally.get(mode) ?? { n: 0, s0: 0, half: 0 };
      const h = Math.floor(x.length / 2);
      const second = med(x.slice(h)), first = med(x.slice(0, h));
      t.n++; if (x[0] > 1.5 * second) t.s0++; if (first > 1.1 * second) t.half++;
      tally.set(mode, t);
    }
  }
  let all = { n: 0, s0: 0, half: 0 };
  for (const [mode, t] of tally) {
    console.log(`(a) gcMode=${mode}: rounds(n>=10)=${t.n}  s0>1.5x second-half median: ${t.s0} (${(100 * t.s0 / t.n).toFixed(1)}%)  first-half median >1.1x second-half: ${t.half} (${(100 * t.half / t.n).toFixed(1)}%)`);
    all = { n: all.n + t.n, s0: all.s0 + t.s0, half: all.half + t.half };
  }
  console.log(`(a) all: rounds=${all.n} s0>1.5x: ${(100 * all.s0 / all.n).toFixed(1)}%  first-half>1.1x: ${(100 * all.half / all.n).toFixed(1)}%`);

  // (b)
  const base = score(s);
  const unranked = base.unranked;
  const noUnranked = score({ ...s, rows: s.rows.filter((r) => !unranked.includes(r.framework)) });
  const rk = (x) => new Map(x.ranking.map((r) => [r.framework, r]));
  const a = rk(base), b = rk(noUnranked);
  const moved = [...a].filter(([fw, r]) => b.get(fw).rank !== r.rank);
  console.log(`(b) unranked: ${unranked.join(", ")}; published-rule ranks reproduced: ${base.ranking.length} ranked, #1 ${base.ranking[0].framework}`);
  console.log(`(b) best computed over ranked frameworks only: ${moved.length} rank changes: ${moved.map(([fw, r]) => `${fw} #${r.rank} (${r.score.toFixed(4)}) -> #${b.get(fw).rank} (${b.get(fw).score.toFixed(4)})`).join("; ") || "none"}`);
  const lite = (x) => x.get("lite-signal");
  console.log(`(b) lite-signal #${lite(a).rank} -> #${lite(b).rank}`);
  // neon F12.5: per-machine-round scores of two adjacent pairs
  for (const fw of ["lite-signal", "rescript-signals", "uSignal", "reactive-engine"]) {
    const r = a.get(fw);
    console.log(`(b') ${fw} #${r.rank} score ${r.score.toFixed(4)} per machine round [${r.perRound.map((x) => x.toFixed(3)).join(", ")}]`);
  }

  // (c)
  const capped100 = new Map();
  for (const row of s.rows) for (const m of row.machines ?? []) for (const r of m.record.rounds ?? []) {
    if (!r.samplesMs || r.samplesMs.length !== 100) continue;
    const tot = r.samplesMs.reduce((p, q) => p + q, 0);
    const c = capped100.get(row.name) ?? { procs: 0, min: Infinity, max: 0 };
    c.procs++; c.min = Math.min(c.min, tot); c.max = Math.max(c.max, tot); capped100.set(row.name, c);
  }
  const short = [...capped100].filter(([, c]) => c.max < 250).sort((x, y) => x[1].max - y[1].max);
  console.log(`(c) rows with processes at the 100-sample cap and total measured time < 250 ms in every such process: ${short.length}`);
  for (const [name, c] of short.slice(0, 8)) console.log(`    ${name}: ${c.procs} processes, total ${c.min.toFixed(2)}..${c.max.toFixed(2)} ms`);
  process.exit(0);
} catch (e) {
  console.log("ERROR " + (e?.stack ?? e));
  process.exit(2);
}
