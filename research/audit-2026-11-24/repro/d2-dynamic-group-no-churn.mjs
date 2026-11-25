// DEFECT (label): the `dynamic` group is documented as "branch switching, dependency cleanup, and
// retracking" (README.md:189, SEMANTICS.md:210). Two of its three rows never change a dependency set, and
// the rows that do (staticFraction < 1) are labelled large_graph = stress suite, outside the score.
// Evidence: dependency-set changes counted inside the timed region of the REAL rows. No timing.
import { verdict, control, runCopy, PUBLISHED_SAMPLES } from "../lib/fable/repro.mjs";
import { buildCounted, runCounted, catalogOf } from "../lib/fable/count-harness.mjs";
import { loadSamples, score } from "../lib/fable/score.mjs";

import { buildMock, runMock } from "../lib/fable/mock-harness.mjs";

await verdict(async () => {
  const run = runCopy();
  const alien = catalogOf(run).find((e) => e.id === "alien");
  const bundle = await buildCounted(run, alien);
  const samples = loadSamples(PUBLISHED_SAMPLES);
  // The group label of each row is taken from the TARGET CHECKOUT's own code (the rows are executed once through
  // the real harness), so a relabelled copy is judged by its own labels.
  const labels = runMock(await buildMock(run), { fault: "none", filter: [...new Set(samples.rows.filter((r) => r.group === "dynamic").map((r) => r.name)), "dynamic/dynamic component"].join(",") });
  const groupOf = (name) => labels.get(name)?.group ?? "?";
  const dynamicRows = [...new Set(samples.rows.filter((r) => r.group === "dynamic").map((r) => r.name))];
  console.log(`rows published in group 'dynamic': ${dynamicRows.join(", ")}`);
  const measure = (name) => {
    const r = runCounted(bundle, `alien-signals :: ${name}`, { pullCounts: true });
    control(!r.failed && r.invocations.length === 4, `real row '${name}' passes its validation`);
    return r.invocations[3];
  };
  console.log("\ntimed region of the real rows (alien-signals); a dependency-set change = a computed or effect body");
  console.log("that reads a different list of nodes than on its previous evaluation:");
  const result = new Map();
  for (const name of dynamicRows) {
    const c = measure(name);
    result.set(name, c);
    console.log(`  ${name.padEnd(40)} group=${groupOf(name).padEnd(11)} computedEvals=${String(c.computedEvals).padStart(7)} effectRuns=${String(c.effectRuns).padStart(6)} batches=${String(c.batches).padStart(5)} dependencySetChanges=${c.depSetChanges}`);
  }
  // control: a row with dynamic nodes (staticFraction 0.75) does change dependency sets -- and is not scored
  const controlRow = "dynamic/dynamic component";
  const c = measure(controlRow);
  console.log(`  ${controlRow.padEnd(40)} group=${groupOf(controlRow).padEnd(11)} computedEvals=${String(c.computedEvals).padStart(7)} effectRuns=${String(c.effectRuns).padStart(6)} batches=${String(c.batches).padStart(5)} dependencySetChanges=${c.depSetChanges}`);
  control(c.depSetChanges > 0, "the counter does see dependency churn where the graph has dynamic nodes");
  const s = score(samples);
  control(!s.coreTests.includes(controlRow), `'${controlRow}' is not a core (scored) scenario`);

  const groups = new Set(s.commonTests.map((t) => s.facts.find((f) => f.name === t).group));
  const zero = dynamicRows.filter((name) => groupOf(name) === "dynamic" && result.get(name).depSetChanges === 0);
  const without = score(samples, { excludeTests: dynamicRows });
  const base = new Map(s.ranking.map((r) => [r.framework, r.rank]));
  const moved = without.ranking.filter((r) => base.get(r.framework) !== r.rank);
  const lite = (x) => x.ranking.find((r) => r.framework === "lite-signal");
  console.log(`\ngroup 'dynamic' weighs ${(100 / groups.size).toFixed(1)}% of the score; without its ${dynamicRows.length} rows ${moved.length} ranks change; lite-signal #${lite(s).rank} (${lite(s).score.toFixed(3)}) -> #${lite(without).rank} (${lite(without).score.toFixed(3)})`);
  return {
    reproduced: zero.length > 0,
    summary: zero.length === 0 ? `no row labelled 'dynamic' by this copy performs 0 dependency-set changes (labels: ${dynamicRows.map((n) => `${n}=${groupOf(n)}`).join(", ")})` : `${zero.length} of the ${dynamicRows.length} rows in group 'dynamic' (${zero.join(", ")}) perform 0 dependency-set changes; ${dynamicRows.filter((n) => !zero.includes(n)).map((n) => `${n}: ${result.get(n).depSetChanges}`).join(", ")}; the unscored '${controlRow}' performs ${c.depSetChanges}`,
  };
});
