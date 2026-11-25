// DEFECT (label, minor): a WRONG result detected while a fixture is being prepared is reported as
// failure kind "error" (a throw), not "incorrect" (src/util/benchmark.ts:152-171: only a throw inside
// entry.validate becomes a ValidationError). The kairo, fan and mol rows run their first delivery check
// inside setup (probe.verifyInitial, an untimed validated run), so an incorrect engine is labelled as if
// it had crashed.
// Evidence: a mock engine through the REAL rows. No timing.
import { verdict, control, runCopy } from "../lib/fable/repro.mjs";
import { buildMock, runMock } from "../lib/fable/mock-harness.mjs";

await verdict(async () => {
  const bundle = await buildMock(runCopy());
  const filter = "diamond,molBench,manySourcesIntoOneDirectEffect,dynamic/pure push";
  const good = runMock(bundle, { fault: "none", filter });
  control([...good.values()].every((r) => r.ok), "no-fault control passes");
  const bad = runMock(bundle, { fault: "effect-never", filter });
  console.log("row | failure kind | message");
  for (const [name, r] of bad) console.log(`  ${name.padEnd(36)} | ${r.ok ? "PASS" : r.kind} | ${r.ok ? "" : r.message.slice(0, 90)}`);
  control(bad.get("dynamic/pure push").kind === "incorrect", "a wrong value found by entry.validate is labelled 'incorrect'");
  const mislabelled = [...bad].filter(([, r]) => !r.ok && r.kind !== "incorrect" && /did not deliver correct values|delivery mismatches|stale/.test(r.message));
  return {
    reproduced: mislabelled.length > 0,
    summary: mislabelled.length
      ? `${mislabelled.length} rows report a wrong result as kind '${mislabelled[0][1].kind}' instead of 'incorrect' (${mislabelled.map(([n]) => n).join(", ")})`
      : "every wrong result is labelled 'incorrect'",
  };
});
