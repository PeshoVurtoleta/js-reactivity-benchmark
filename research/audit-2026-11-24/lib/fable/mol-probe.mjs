// Per-node evaluation counts for upstream's REAL molBench fixture (src/molBench.ts: molWorkload), per
// real adapter. The fixture factory, run() and validate() are upstream's; the wrapper only counts.
// fixture.run() is exactly the statement the row times (molBench.ts:160).
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { TMP } from "./repro.mjs";

const entrySource = (module, exportName) => `
import { ${exportName} as base } from "./frameworks/${module}";
import { molWorkload } from "./molBench";
const b: any = base;
const evals: number[] = [];
const runs: number[] = [];
const framework: any = {
  name: b.name,
  signal: (v: any) => b.signal(v),
  computed(fn: () => any) {
    const k = evals.length;
    evals.push(0);
    return b.computed(() => { evals[k]++; return fn(); });
  },
  effect(fn: () => void) {
    const k = runs.length;
    runs.push(0);
    return b.effect(() => { runs[k]++; fn(); });
  },
  withBatch: (fn: () => any) => b.withBatch(fn),
  withBuild: (fn: () => any) => b.withBuild(fn),
  createScope: b.createScope ? (fn: () => any) => b.createScope(fn) : undefined,
};
b.resetBenchmark?.();
const fixture = molWorkload(framework); // setup: build, initial effects, one untimed run
const e0 = [...evals], r0 = [...runs];
const result = fixture.run();           // the timed statement of the row
fixture.validate(result);               // the row's real validation
console.log("MOLPROBE " + JSON.stringify({
  name: b.name,
  computed: Object.fromEntries(["c", "d", "e", "f", "g"].map((n, i) => [n, evals[i] - e0[i]])),
  effects: Object.fromEntries(["H=hard(g)", "I=g", "J=hard(f)"].map((n, i) => [n, runs[i] - r0[i]])),
  final: result.final,
}));
fixture.dispose();
`;

export const FRESH_ARRAY = {
  file: "src/molBench.ts",
  from: "      return items;",
  to: "      return items.map((item) => ({ x: item.x }));",
};

/** variant "real" = unmodified molBench.ts; "fresh" = d returns a new array (one build-time substitution). */
export async function molProbe(runCopy, entry, variant = "real") {
  mkdirSync(TMP, { recursive: true });
  const require = createRequire(path.join(runCopy, "package.json"));
  const { build } = require("esbuild");
  const { readFileSync } = await import("node:fs");
  const { moduleAliases } = await import(pathToFileURL(path.join(runCopy, "scripts/module-aliases.mjs")).href);
  const outfile = path.join(TMP, `mol-${entry.id}-${variant}.cjs`);
  const target = path.join(runCopy, FRESH_ARRAY.file);
  await build({
    absWorkingDir: runCopy, bundle: true, platform: "node", target: "node22", format: "cjs",
    conditions: ["production", "module"], alias: moduleAliases,
    define: { "process.env.NODE_ENV": '"production"' }, banner: { js: 'process.env.NODE_ENV = "production";' },
    outfile, logLevel: "silent",
    plugins: variant === "fresh" ? [{
      name: "fresh-array",
      setup(b) {
        b.onLoad({ filter: /molBench\.ts$/ }, (args) => {
          if (path.resolve(args.path) !== target) return undefined;
          const source = readFileSync(args.path, "utf8");
          // A copy that already returns a fresh array has no anchor: its "fresh" variant is the file itself.
          if (source.split(FRESH_ARRAY.from).length !== 2) return { loader: "ts", contents: source };
          return { loader: "ts", contents: source.replace(FRESH_ARRAY.from, FRESH_ARRAY.to) };
        });
      },
    }] : [],
    stdin: { loader: "ts", resolveDir: path.join(runCopy, "src"), sourcefile: `mol-${entry.id}.ts`, contents: entrySource(entry.module, entry.export) },
  });
  const child = spawnSync(process.execPath, [outfile], { cwd: TMP, env: { ...process.env, TMPDIR: TMP }, encoding: "utf8", timeout: 60_000, killSignal: "SIGKILL" });
  const line = (child.stdout ?? "").split(/\r?\n/).find((l) => l.startsWith("MOLPROBE "));
  if (child.status !== 0 || !line) return { name: entry.name, error: ((child.stderr ?? "") + (child.stdout ?? "")).split(/\r?\n/).filter((l) => l && !/^\s+at /.test(l)).slice(-2).join(" | ").slice(0, 200) };
  return JSON.parse(line.slice("MOLPROBE ".length));
}
