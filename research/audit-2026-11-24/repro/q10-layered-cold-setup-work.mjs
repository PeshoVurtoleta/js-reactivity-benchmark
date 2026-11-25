// QUESTION (earlier note 3 of 2026-11-10, re-checked at 12f169b): `dynamic/layered full-drain cold`
// builds its graph in setup (measureBuild: false, src/workloads.ts:49-62). Engines that evaluate computeds
// at creation do the 16384 first evaluations there, off the clock; lazy engines do them inside the timed
// call. Same row, different timed work.
// Evidence: counters inside the timed call of the real row per real adapter; published counters. No timing.
import { readFileSync } from "node:fs";
import { verdict, control, runCopy, PUBLISHED_LOG } from "../lib/fable/repro.mjs";
import { buildCounted, runCounted, catalogOf } from "../lib/fable/count-harness.mjs";

await verdict(async () => {
  const run = runCopy();
  const catalog = catalogOf(run);
  const measure = async (id, row) => {
    const entry = catalog.find((e) => e.id === id);
    const r = runCounted(await buildCounted(run, entry), `${entry.name} :: ${row}`, { pullCounts: !!entry.pullCounts });
    control(!r.failed && r.invocations.length === 4, `${entry.name} :: ${row} passes its own validation`);
    return { name: entry.name, ...r.invocations[3] };
  };
  console.log("timed call of the real row 'dynamic/layered full-drain cold' (control: the same graph, warm):");
  console.log("engine | cold: computed evaluations | cold: of which FIRST evaluations | warm row: computed evaluations");
  const rows = [];
  for (const id of ["alien", "lite", "preact", "s", "solid", "anod"]) {
    const cold = await measure(id, "dynamic/layered full-drain cold");
    const warm = await measure(id, "dynamic/layered full-drain warm");
    rows.push({ id, cold, warm });
    console.log(`  ${cold.name.padEnd(16)} | ${cold.computedEvals} | ${cold.firstEvals} | ${warm.computedEvals}`);
  }
  control(new Set(rows.map((r) => r.warm.computedEvals)).size === 1, "control: on the warm row every engine does the same number of evaluations");
  const groups = new Map();
  for (const line of readFileSync(PUBLISHED_LOG, "utf8").split("\n")) {
    if (!line.includes("(layered full-drain cold)")) continue;
    const m = /nodesRecomputed=(\d+)/.exec(line);
    if (!m) continue;
    (groups.get(m[1]) ?? groups.set(m[1], []).get(m[1])).push(line.split(",")[0].trim());
  }
  console.log("published log, nodesRecomputed of this row:");
  for (const [k, v] of groups) console.log(`  ${k}: ${v.length} (${v.join(", ")})`);
  const lazy = rows.filter((r) => r.cold.firstEvals > 0), eager = rows.filter((r) => r.cold.firstEvals === 0);
  const reproduced = lazy.length > 0 && eager.length > 0;
  return {
    reproduced,
    summary: reproduced
      ? `${lazy.map((r) => r.cold.name).join(", ")} do ${lazy[0].cold.firstEvals} first evaluations inside the timed call; ${eager.map((r) => r.cold.name).join(", ")} do them in setup (timed evaluations ${lazy[0].cold.computedEvals} vs ${eager[0].cold.computedEvals}); the row is in the unscored stress suite`
      : "every probed engine does the same first evaluations inside the timed call",
  };
});
