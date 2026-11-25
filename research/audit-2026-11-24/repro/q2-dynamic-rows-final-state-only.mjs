// QUESTION: the 15 dependency-graph rows validate ONE number: the sum of a final sink pass
// (src/util/dependencyGraph.ts:155, src/util/referenceGraph.ts). Everything read inside the loop is
// unverified; 8 of the 15 rows have no recomputation-count target for anybody (expected: {}), and 9
// adapters are never count-checked. So the sum does not prove the per-iteration work was done.
// Evidence: mock engines run through the REAL rows and REAL validation. ~2 minutes. No timing.
import { readFileSync } from "node:fs";
import path from "node:path";
import { verdict, control, runCopy, BASE } from "../lib/fable/repro.mjs";
import { buildMock, runMock } from "../lib/fable/mock-harness.mjs";

await verdict(async () => {
  const bundle = await buildMock(runCopy());
  const filter = "dynamic/,updateComputations1to1";
  const good = runMock(bundle, { fault: "none", filter, pullCounts: true });
  const names = [...good.keys()];
  const dynamic = names.filter((n) => n.startsWith("dynamic/"));
  control(dynamic.length === 15, `15 dependency-graph rows selected (${dynamic.length})`);
  control([...good.values()].every((r) => r.ok), "no-fault control passes every row, with pull counts asserted");
  const stale = runMock(bundle, { fault: "stale-toplevel-read", filter, pullCounts: true });
  const wrong = runMock(bundle, { fault: "wrong-read-sporadic", filter, pullCounts: true });
  const twice = runMock(bundle, { fault: "double-eval", filter, pullCounts: true });
  const twiceNoCount = runMock(bundle, { fault: "double-eval", filter, pullCounts: false });
  console.log("row | stale: a top-level read returns the PREVIOUS read's value | wrong: every 997th top-level read is +1 | every node evaluated twice (pull-count adapter) | evaluated twice (adapter without pull counts)");
  const f = (r) => (r.ok ? "PASS" : "caught");
  for (const name of names)
    console.log(`  ${name.padEnd(36)} | ${f(stale.get(name)).padEnd(6)} | ${f(wrong.get(name)).padEnd(6)} | ${f(twice.get(name)).padEnd(6)} | ${f(twiceNoCount.get(name))}`);
  control(!stale.get("updateComputations1to1").ok && !wrong.get("updateComputations1to1").ok, "both read faults are real: a row that checksums every read catches them");
  const stalePass = dynamic.filter((n) => stale.get(n).ok);
  const wrongPass = dynamic.filter((n) => wrong.get(n).ok);
  const twicePass = dynamic.filter((n) => twice.get(n).ok);
  const catalog = JSON.parse(readFileSync(path.join(BASE, "src/frameworkCatalog.json"), "utf8"));
  const noCounts = catalog.filter((e) => !e.pullCounts).map((e) => e.name);
  console.log(`\nadapters never count-checked (no pullCounts in src/frameworkCatalog.json): ${noCounts.length}: ${noCounts.join(", ")}`);
  return {
    reproduced: stalePass.length === dynamic.length,
    summary: `a mock whose every in-loop sink read is stale passes ${stalePass.length}/${dynamic.length} dependency-graph rows; sporadically wrong reads pass ${wrongPass.length}; double evaluation passes ${twicePass.length} even with pull counts asserted (rows with expected: {}) and all 15 without`,
  };
});
