// repro-censor-exclusion: a censored or partial core row removes that scenario from EVERY engine's score
// (scripts/render-results-page.mjs:310-318; README.md:28). In the published run this drops 2 of 36 core
// scenarios (dynamic/pure push: Svelte censored, @reatom/core partial; manyEffectsFromOneSource: kairo and
// @reatom/core censored). Consequence: the score is not monotone in time. Counterfactual: the same engines
// complete those rows just UNDER the 1500 ms floor (i.e. FASTER than their censored >1500 ms) -> the scenarios
// re-enter, and an engine's score can get WORSE although it got faster (non-monotone). Control: a 10% slowdown of a measured row worsens the score.
import { main, samples } from "../lib/opus/common.mjs";
import { score, status } from "../lib/opus/score.mjs";
main(async () => {
  const d = samples();
  const base = score(d);
  const excluded = base.coreTests.filter((t) => !base.common.includes(t));
  const culprits = d.rows.filter((r) => excluded.includes(r.name) && status(r) !== "measured").map((r) => `${r.framework}@${r.name}:${status(r)}`);
  const cf = JSON.parse(JSON.stringify(d));
  for (const r of cf.rows) if (excluded.includes(r.name) && (status(r) === "capped" || status(r) === "partial")) {
    const est = [1, 2, 3].map((m) => { const i = r.machineIds?.indexOf(m) ?? -1; return i >= 0 ? r.machineEstimatesMs[i] : 1499; });
    Object.assign(r, { capped: false, censored: false, partial: false, machineEstimatesMs: est });
  }
  const after = score(cf);
  const get = (res, f) => res.ranked.find((x) => x.framework === f);
  const victims = ["Svelte v5", "kairo 0.8 alpha", "@reatom/core"].map((f) => ({ f, b: get(base, f), a: get(after, f) }));
  const worse = victims.filter((v) => v.a.score > v.b.score);
  // control: monotone in the normal range
  const ctl = JSON.parse(JSON.stringify(d));
  const row = ctl.rows.find((r) => r.framework === "Svelte v5" && r.name === "updateComputations1to1");
  row.machineEstimatesMs = row.machineEstimatesMs.map((v) => v * 1.1);
  if (!(get(score(ctl), "Svelte v5").score > get(base, "Svelte v5").score)) throw new Error("control failed: slowdown did not worsen score");
  const moved = after.ranked.filter((x) => get(base, x.framework).rank !== x.rank).map((x) => `${x.framework} ${get(base, x.framework).rank}->${x.rank}`);
  return {
    reproduced: excluded.length > 0 && worse.length > 0,
    line: `excluded core scenarios: ${excluded.join(", ")} (caused by ${culprits.join(", ")}); if those engines had been FASTER (1499 ms, measured): ${victims.map((v) => `${v.f} ${v.b.score.toFixed(2)}x/#${v.b.rank} -> ${v.a.score.toFixed(2)}x/#${v.a.rank}`).join("; ")}; engines whose score got WORSE by being faster: ${worse.map((v) => v.f).join(", ") || "none"}; rank moves: ${moved.join(", ") || "none"}; lite-signal ${get(base, "lite-signal").rank}->${get(after, "lite-signal").rank}.`,
  };
});
