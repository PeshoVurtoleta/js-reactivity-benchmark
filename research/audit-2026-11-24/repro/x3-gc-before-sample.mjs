// repro-gc-before-sample (Phase 3, earlier note 4 at fb10dd9): "a full GC before each sample can hide GC cost on short
// rows" (diamond, molBench, cellx1000, manyEffectsFromOneSource named). At 12f169b, src/util/benchmark.ts:866-872 runs
// gc() before every invocation only in mode "cold" (creation), and once per process otherwise. Checks the published
// gcMode of the named rows and the code. Control: creation rows must still be "cold".
import { readFileSync } from "node:fs";
import path from "node:path";
import { main, B, samples } from "../lib/opus/common.mjs";
main(async () => {
  const d = samples();
  const named = ["diamond", "molBench", "cellx1000", "manyEffectsFromOneSource"];
  const modes = named.map((n) => [n, [...new Set(d.rows.filter((r) => r.name === n).map((r) => r.gcMode))].join("/")]);
  const creation = [...new Set(d.rows.filter((r) => r.group === "creation").map((r) => r.gcMode))];
  const src = readFileSync(path.join(B, "src/util/benchmark.ts"), "utf8");
  const codeCold = src.includes('if (hasGc && (mode === "cold" || !collected))');
  if (!(creation.length === 1 && creation[0] === "cold")) throw new Error("control failed: creation rows not cold " + creation);
  return { reproduced: modes.some(([, m]) => m.includes("cold")) || !codeCold, line: `12f169b gcMode: ${modes.map(([n, m]) => `${n}=${m}`).join(", ")}; per-invocation gc only for mode cold (benchmark.ts:869 ${codeCold ? "present" : "CHANGED"}); creation rows = ${creation} (control). The note still applies to the 10 creation rows, by declared design.` };
});
