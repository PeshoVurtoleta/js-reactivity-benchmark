// repro-score-recompute: does an INDEPENDENT implementation of the documented score
// (README.md:225-236, SEMANTICS.md:343-359) reproduce the published ranks and scores from
// bench-results/latest.samples.json? A mismatch would be a defect. Control: the scorer must
// change the ranking when a row is perturbed (so a match is not vacuous).
import { readFileSync } from "node:fs";
import path from "node:path";
import { main, B, samples } from "../lib/opus/common.mjs";
import { score } from "../lib/opus/score.mjs";
main(async () => {
  const d = samples();
  const html = readFileSync(path.join(B, "index.html"), "utf8");
  const rows = [...html.matchAll(/<tr><td class="rank">(\d+)[^<]*<\/td><td class="framework[^"]*">([^<]*)<\/td><td class="time">([\d.]+)x/g)]
    .map((m) => ({ rank: +m[1], fw: m[2].replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"'), score: +m[3] }));
  if (rows.length < 20) throw new Error("could not parse published leaderboard");
  const mine = score(d).ranked;
  const mism = rows.filter((r) => { const x = mine.find((m) => m.framework === r.fw); return !x || x.rank !== r.rank || x.score.toFixed(2) !== r.score.toFixed(2); });
  // control: perturb lite-signal's core rows by x1.2 -> its rank must drop
  const p = JSON.parse(JSON.stringify(d));
  for (const r of p.rows) if (r.framework === "lite-signal" && r.machineEstimatesMs) r.machineEstimatesMs = r.machineEstimatesMs.map((v) => v * 1.2);
  const before = mine.find((x) => x.framework === "lite-signal").rank, after = score(p).ranked.find((x) => x.framework === "lite-signal").rank;
  if (!(after > before)) throw new Error("control failed: scorer insensitive to a 20% slowdown");
  return { reproduced: mism.length > 0, line: `independent scorer vs published page: ${rows.length} ranked rows, ${mism.length} mismatches${mism.length ? " " + JSON.stringify(mism) : ""}; control (lite-signal x1.2) moves rank ${before}->${after}.` };
});
