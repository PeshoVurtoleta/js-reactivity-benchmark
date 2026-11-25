// QUESTION: whether a slow row is censored or measured depends on WHEN it ran in its scenario
// (the supervised ceiling uses the best probe seen so far), and on which VM it landed (1500 ms floor).
// Evidence: published samples only. No timing.
import { verdict, control, PUBLISHED_SAMPLES } from "../lib/fable/repro.mjs";
import { loadSamples, suiteOf } from "../lib/fable/score.mjs";

await verdict(async () => {
  const samples = loadSamples(PUBLISHED_SAMPLES);
  // per (machine round, scenario): every row's fate on that one VM
  const cells = new Map();
  for (const row of samples.rows) for (const m of row.machines ?? []) {
    const rec = m.record;
    if (rec.status === "failed") continue;
    const key = `${m.machineRound}\u0000${row.name}`;
    const list = cells.get(key) ?? cells.set(key, []).get(key);
    if (rec.capped) list.push({ fw: row.framework, censored: true, ceiling: rec.ceilingMs, probe: rec.rounds?.[0]?.censorMs, phase: rec.censorPhase });
    else list.push({ fw: row.framework, censored: false, probe: rec.rounds[0].censorMs, pilot: rec.rounds[0].pilotMs });
  }
  // (1) same VM, same scenario: a measured row whose own censor probe exceeds the ceiling that censored another row
  const sameVm = [];
  const ceilingSets = [];
  for (const [key, list] of cells) {
    const [round, name] = key.split("\u0000");
    const ceilings = [...new Set(list.filter((x) => x.censored).map((x) => x.ceiling))].sort((a, b) => a - b);
    if (ceilings.length > 1) ceilingSets.push({ round, name, ceilings });
    for (const c of list.filter((x) => x.censored))
      for (const mrow of list.filter((x) => !x.censored && x.probe > c.ceiling))
        sameVm.push({ round, name, suite: suiteOf(samples.rows.find((r) => r.name === name).group), censored: c, measured: mrow });
  }
  console.log("scenarios in which one VM applied more than one ceiling:");
  for (const c of ceilingSets) console.log(`  machine round ${c.round} ${c.name}: ${c.ceilings.map((x) => x.toFixed(1)).join(" / ")} ms`);
  console.log("\nsame VM, same scenario: measured although its probe was above the ceiling that censored another row:");
  for (const p of sameVm) console.log(`  [${p.suite}] machine round ${p.round} ${p.name}: ${p.measured.fw} MEASURED (probe ${p.measured.probe.toFixed(1)} ms) vs ${p.censored.fw} CENSORED at ${p.censored.ceiling.toFixed(1)} ms${p.censored.probe ? ` (its completed probe: ${p.censored.probe.toFixed(1)} ms)` : " (killed by the watchdog)"}`);

  // (2) across VMs: the same row measured on one VM with a probe above the ceiling that censored it on another
  const acrossVm = [];
  for (const row of samples.rows) {
    const ms = (row.machines ?? []).filter((m) => m.record.status !== "failed");
    for (const c of ms.filter((m) => m.record.capped)) for (const g of ms.filter((m) => !m.record.capped))
      if (g.record.rounds[0].censorMs > c.record.ceilingMs)
        acrossVm.push(`${row.id}: machine round ${g.machineRound} measured (probe ${g.record.rounds[0].censorMs.toFixed(1)} ms) vs machine round ${c.machineRound} censored at ${c.record.ceilingMs.toFixed(1)} ms`);
  }
  console.log(`\nsame row, different VM: measured with a probe above the ceiling that censored it elsewhere: ${acrossVm.length}`);
  for (const line of acrossVm) console.log("  " + line);

  // no-fault control: where a scenario has a single ceiling on a VM, no measured probe exceeds it
  let violations = 0, checked = 0;
  for (const [, list] of cells) {
    const ceilings = [...new Set(list.filter((x) => x.censored).map((x) => x.ceiling))];
    if (ceilings.length !== 1) continue;
    checked++;
    if (list.some((x) => !x.censored && x.probe > ceilings[0])) violations++;
  }
  control(checked > 0 && violations === 0, `${checked} (VM, scenario) cells with ONE ceiling: no measured probe above it`);

  const partial = samples.rows.filter((r) => r.partial).length;
  const core = sameVm.filter((p) => p.suite === "core").length;
  return {
    reproduced: sameVm.length > 0,
    summary: `${sameVm.length} same-VM pair(s) where the row with the LARGER probe was measured and the smaller one censored (${core} in core scenarios), ${ceilingSets.length} (VM, scenario) cell(s) with several ceilings, ${acrossVm.length} cross-VM inconsistencies; ${partial} rows are 'partial'`,
  };
});
