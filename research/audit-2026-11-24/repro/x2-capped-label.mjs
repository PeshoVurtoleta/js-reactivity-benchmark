// repro-capped-label (Phase 3, earlier note 1 at fb10dd9): "the capped label follows the first machine only".
// Re-checked at 12f169b from the published files: for every non-failed row, the log label (CENSORED / partial=true /
// measured) must match the per-machine records in latest.samples.json. Control: the checker flags a forged mismatch.
import { readFileSync } from "node:fs";
import path from "node:path";
import { main, B, samples } from "../lib/opus/common.mjs";
main(async () => {
  const d = samples();
  const log = readFileSync(path.join(B, "bench-results/latest.log"), "utf8").split("\n").filter((l) => l.includes(" , ") && !l.startsWith("framework"));
  const lineOf = (r) => log.find((l) => { const p = l.split(" , "); return p[0].trim() === r.framework && (p[1].trim() === r.name || p[1].includes("(" + r.name.replace("dynamic/", "") + ")")); }) ?? "";
  const check = (rows, labelOf) => rows.filter((r) => r.status !== "failed" && r.machines?.length).filter((r) => {
    const caps = r.machines.map((m) => !!m.record?.capped);
    const want = caps.every(Boolean) ? "censored" : caps.some(Boolean) ? "partial" : "measured";
    return labelOf(r) !== want;
  });
  const label = (r) => { const l = lineOf(r); return /CENSORED/.test(l) ? "censored" : /partial=true/.test(l) ? "partial" : "measured"; };
  const mixed = d.rows.filter((r) => r.status !== "failed" && r.machines?.some((m) => m.record?.capped) && !r.machines.every((m) => m.record?.capped)).length;
  const bad = check(d.rows, label);
  const forged = check(d.rows.filter((r) => r.partial).slice(0, 1), () => "measured");
  if (forged.length !== 1) throw new Error("control failed: forged mismatch not detected");
  return { reproduced: bad.length > 0, line: `12f169b: ${mixed} rows with mixed machine censoring; label mismatches = ${bad.length}${bad.length ? " e.g. " + bad.slice(0, 3).map((r) => r.id).join("; ") : ""} (control: forged mismatch detected).` };
});
