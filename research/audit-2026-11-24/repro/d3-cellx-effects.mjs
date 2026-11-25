// repro-cellx-effects (part (a)): SEMANTICS.md:371-375 / methodology.md:246 claim every active row validates its values or
// deliveries ("Every produced result is validated"). Run upstream's REAL rows + REAL validation in-process with
// injected-fault engines (lib/mockEngine.ts):
//  (a) skipEffects (effects never re-run after their first run): cellx1000/cellx2500 (core, src/cellxBench.ts:104-107:
//      effects have no observable output) still PASS; control: the same fault FAILS diamond (core, delivery-probed).
//  (b) lagSinkRead (a dirty computed read OUTSIDE any computation returns its previous value on its first read): the 8 large_graph rows with
//      `expected: {}` (src/workloads.ts:16..111) PASS when pull counts are not asserted (10 adapters), because
//      in-loop sink reads are discarded (src/util/dependencyGraph.ts:148,152) and only the final pass is checked.
//  No-fault control: the correct engine passes every selected row.
import { main, runPath, bundleSuite, runChild, SCRATCH } from "../lib/opus/common.mjs";
import path from "node:path";
const LIB = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "lib", "opus");
const rowsOf = (log) => log.split("\n").filter((l) => l.includes(" , ") && !l.startsWith("framework")).map((l) => { const p = l.split(" , "); return { test: p[1].trim(), failed: p[2].trim() === "FAILED" }; });
main(async () => {
  const run = runPath();
  const file = await bundleSuite(run, "cellx-effects", "suite", `${LIB}/mockEngine`, { pullCounts: false });
  const exec = (fault, filter) => {
    const r = runChild(file, { timeoutMs: 600000, env: { MOCK_FAULT: fault, BENCH_IN_PROCESS: "1", BENCH_SAMPLES: "1", BENCH_ALLOW_FAILURES: "1", BENCH_MIN_CEILING_MS: "1e9", BENCH_FILTER: filter, BENCH_SAMPLES_FILE: path.join(SCRATCH, "repro-tmp", "cellx-effects", fault + ".json") } });
    return rowsOf(r.stdout);
  };
  const A = "cellx1000,cellx2500,diamond";
  const Bf = ["dashboard selective reads","editor derived state","kanban board","entity detail page","layered full-drain cold","layered full-drain warm","layered burst flush warm","stable diamond mesh warm","wide dense","large web app","deep","simple component","dynamic component"].map((n) => "dynamic/" + n).join(",");
  const ok = exec("none", A);
  if (ok.length < 3 || ok.some((r) => r.failed)) throw new Error("no-fault control failed: " + JSON.stringify(ok.filter((r) => r.failed)));
  const a = exec("skipEffects", A);
  const pass = (rs) => rs.filter((r) => !r.failed).map((r) => r.test.replace(/.*\((.*)\)$/, "$1"));
  const fail = (rs) => rs.filter((r) => r.failed).map((r) => r.test.replace(/.*\((.*)\)$/, "$1"));
  const cellxPass = pass(a).filter((t) => t.startsWith("cellx")).length === 2;
  const diamondFails = fail(a).includes("diamond");
  if (!diamondFails) throw new Error("control failed: skipEffects should fail diamond");
  return {
    reproduced: cellxPass,
    line: `(a) skipEffects passes: ${pass(a).join(", ")}; fails: ${fail(a).join(", ")} (control). Correct engine: ${ok.length}/${ok.length} pass.`,
  };
});
