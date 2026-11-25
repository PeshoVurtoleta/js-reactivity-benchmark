// repro-adapter-docs: README.md:269 says "The default run contains 29 library/version rows"; adapter-audit.md:4 and
// production.md:78 say 29; the run registers 30 (src/config.ts:35-66, src/frameworkCatalog.json) and the published
// samples hold 30 engines. The missing row is reflex-quant -- ranked #1 and a censoring anchor (benchmark.ts:620) --
// which has no row in README's adapter table (README.md:274-304), SEMANTICS' adapter matrix (SEMANTICS.md:121-149),
// docs/adapter-audit.md or docs/adapter-recheck.md. Control: every other active engine name appears in the README table.
import { readFileSync } from "node:fs";
import path from "node:path";
import { main, B, samples } from "../lib/opus/common.mjs";
main(async () => {
  const read = (f) => readFileSync(path.join(B, f), "utf8");
  const catalog = JSON.parse(read("src/frameworkCatalog.json"));
  const engines = [...new Set(samples().rows.map((r) => r.framework))];
  const readmeTable = read("README.md").split("## Framework Adapters")[1].split("Two adapters remain")[0];
  const modules = catalog.map((c) => c.module);
  const missingReadme = catalog.filter((c) => !readmeTable.includes(`(src/frameworks/${c.module}.ts)`)).map((c) => c.name);
  const matrix = read("SEMANTICS.md").split("### Adapter matrix")[1].split("Minimal recomputation asserted\" means")[0];
  const audit = read("docs/adapter-audit.md") + read("docs/adapter-recheck.md");
  const inMatrix = (n) => matrix.includes(n) || matrix.toLowerCase().includes(n.toLowerCase());
  const q = "reflex-quant";
  const claims = [["README.md", /contains (\d+) library\/version rows/], ["docs/adapter-audit.md", /consists of the (\d+) entries/], ["docs/production.md", /all (\d+) frameworks/]].map(([f, re]) => [f, +read(f).match(re)[1]]);
  if (missingReadme.length > 1) throw new Error("control failed: other engines also missing from README table: " + missingReadme);
  return {
    reproduced: catalog.length !== claims[0][1] && missingReadme.includes(q) && !inMatrix(q) && !audit.includes(q),
    line: `catalog=${catalog.length}, published engines=${engines.length}, doc counts ${claims.map(([f, n]) => `${f}=${n}`).join(", ")}; missing from README adapter table: ${missingReadme.join(",") || "none"}; reflex-quant in SEMANTICS matrix=${inMatrix(q)}, in adapter-audit/recheck=${audit.includes(q)}; published rank of reflex-quant=1.`,
  };
});
