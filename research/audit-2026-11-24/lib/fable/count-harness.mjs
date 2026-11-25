// Counts the work done INSIDE the timed region of upstream's real rows, per real adapter.
// - The adapter is wrapped: every signal/computed/effect/batch call is counted, nothing else changes.
// - The harness is instrumented at build time by ONE text substitution around the timed call in
//   src/util/benchmark.ts (fail closed if the anchor is not found exactly once), so the counters cover
//   exactly `entry.benchmark(fixture)`: the same statement the harness times.
// - Each row runs through the real worker path (BENCH_CASE), one process per row.
// No timing is used. Counters are deterministic.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SCRATCH_ROOT } from "../scratch.mjs";

export const AUDIT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TMP = path.join(SCRATCH_ROOT, "fable"); // outside the repository
const ANCHOR = "result = entry.benchmark(fixture);";

const entrySource = (module, exportName) => `
import { ${exportName} as base } from "./frameworks/${module}";
import { registerFrameworkBenchmarks } from "./suite";
import { runBenchmarks } from "./util/benchmark";
import { appendFileSync } from "node:fs";
const zero = () => ({ computedEvals: 0, firstEvals: 0, reEvals: 0, effectRuns: 0, writes: 0, batches: 0, topReads: 0, innerReads: 0,
  signalsCreated: 0, computedsCreated: 0, effectsCreated: 0, scopeCreates: 0, scopeDisposes: 0, depSetChanges: 0 });
let C = zero();
let nextId = 1;
const frames: number[][] = [];
const noteRead = (id: number) => {
  if (frames.length) { C.innerReads++; frames[frames.length - 1].push(id); } else C.topReads++;
};
const tracked = (fn: () => any) => {
  let previous: string | undefined;
  return () => {
    const frame: number[] = [];
    frames.push(frame);
    try {
      return fn();
    } finally {
      frames.pop();
      const signature = frame.join(",");
      if (previous !== undefined && previous !== signature) C.depSetChanges++;
      previous = signature;
    }
  };
};
const b: any = base;
const framework: any = {
  name: b.name,
  signal(v: any) {
    C.signalsCreated++;
    const id = nextId++;
    const s = b.signal(v);
    return { read() { noteRead(id); return s.read(); }, write(x: any) { C.writes++; s.write(x); } };
  },
  computed(fn: () => any) {
    C.computedsCreated++;
    const id = nextId++;
    const body = tracked(fn);
    let evaluated = false;
    const c = b.computed(() => {
      C.computedEvals++;
      if (evaluated) C.reEvals++;
      else { evaluated = true; C.firstEvals++; }
      return body();
    });
    return { read() { noteRead(id); return c.read(); } };
  },
  effect(fn: () => void) {
    C.effectsCreated++;
    const body = tracked(fn);
    return b.effect(() => { C.effectRuns++; body(); });
  },
  withBatch(fn: () => any) { C.batches++; return b.withBatch(fn); },
  withBuild: (fn: () => any) => b.withBuild(fn),
  createScope: b.createScope
    ? (fn: () => any) => {
        C.scopeCreates++;
        const scope = b.createScope(fn);
        return { value: scope.value, dispose() { C.scopeDisposes++; scope.dispose(); } };
      }
    : undefined,
  resetBenchmark: b.resetBenchmark ? () => b.resetBenchmark() : undefined,
  benchmarkMetrics: b.benchmarkMetrics,
};
let invocation = 0;
// Optional memory probe (COUNT_HEAP=1): live heap right before the timed call, after a forced full GC.
// COUNT_DRAIN=1 (needs node --allow-natives-syntax) first runs a microtask checkpoint: the control that
// shows what the heap would be if the sample loop ever returned to the microtask queue.
let heapUsed: number | undefined;
// Microtasks queued through queueMicrotask() (Promise reactions are not seen): none of them can run before
// the worker's synchronous sample loop ends.
// Optional GC probe (COUNT_GC=1): garbage collections that START inside the timed call (v8.GCProfiler).
import { GCProfiler } from "node:v8";
let gcProfiler: GCProfiler | undefined;
let gcEvents: string[] | undefined;
let microtasks = 0;
const nativeQueueMicrotask = globalThis.queueMicrotask;
globalThis.queueMicrotask = (fn: () => void) => { microtasks++; nativeQueueMicrotask(fn); };
const drain = process.env.COUNT_DRAIN === "1" ? new Function("%PerformMicrotaskCheckpoint()") : undefined;
(globalThis as any).__timedStart = () => {
  C = zero();
  microtasks = 0;
  if (process.env.COUNT_HEAP === "1") {
    drain?.();
    (globalThis as any).gc();
    heapUsed = process.memoryUsage().heapUsed;
  }
  if (process.env.COUNT_GC === "1") {
    gcProfiler = new GCProfiler();
    gcProfiler.start();
  }
};
(globalThis as any).__timedEnd = (id: string) => {
  if (gcProfiler) {
    gcEvents = (gcProfiler.stop() as any).statistics.map((x: any) => x.gcType);
    gcProfiler = undefined;
  }
  appendFileSync(process.env.COUNT_OUT!, JSON.stringify({ id, invocation: invocation++, ...C, heapUsed, microtasksQueued: microtasks, gcEvents }) + "\\n");
};
// COUNT_PLAIN=1 registers the adapter WITHOUT the counting wrapper (the wrapper allocates, which would
// distort the heap and GC probes); the timed-region hooks stay.
registerFrameworkBenchmarks({ framework: process.env.COUNT_PLAIN === "1" ? b : framework, testPullCounts: process.env.COUNT_PULLCOUNTS === "1" });
runBenchmarks().catch((error) => { console.error(error); process.exitCode = 1; });
`;

/**
 * options.substitutions: [{ file: "src/x.ts", from, to }] one-step source edits applied at BUILD time only
 * (nothing is written into the target checkout); each `from` must occur exactly once (fail closed).
 * options.tag: suffix for the bundle file name.
 */
export async function buildCounted(runCopy, entry, options = {}) {
  const substitutions = (options.substitutions ?? []).map((sub) => ({ ...sub, abs: path.join(runCopy, sub.file) }));
  mkdirSync(TMP, { recursive: true });
  const require = createRequire(path.join(runCopy, "package.json"));
  const { build } = require("esbuild");
  const { moduleAliases } = await import(pathToFileURL(path.join(runCopy, "scripts/module-aliases.mjs")).href);
  const outfile = path.join(TMP, `count-${entry.id}${options.tag ? "-" + options.tag : ""}.cjs`);
  const target = path.join(runCopy, "src/util/benchmark.ts");
  await build({
    absWorkingDir: runCopy,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    conditions: ["production", "module"],
    alias: moduleAliases,
    define: { "process.env.NODE_ENV": '"production"' },
    banner: { js: 'process.env.NODE_ENV = "production";' },
    outfile,
    logLevel: "silent",
    plugins: [{
      name: "instrument-timed-region",
      setup(b) {
        b.onLoad({ filter: /\.ts$/ }, (args) => {
          const file = path.resolve(args.path);
          const subs = substitutions.filter((sub) => path.resolve(sub.abs) === file);
          if (file !== target && !subs.length) return undefined;
          let source = readFileSync(args.path, "utf8");
          for (const sub of subs) {
            if (source.split(sub.from).length !== 2)
              throw new Error(`substitution anchor not found exactly once in ${sub.file}: ${sub.from}`);
            source = source.replace(sub.from, sub.to);
          }
          if (file === target) {
            if (source.split(ANCHOR).length !== 2)
              throw new Error("timed-region anchor not found exactly once in src/util/benchmark.ts");
            source = source.replace(ANCHOR,
              "(globalThis as any).__timedStart?.(entry.id); result = entry.benchmark(fixture); (globalThis as any).__timedEnd?.(entry.id);");
          }
          return { loader: "ts", contents: source };
        });
      },
    }],
    stdin: { loader: "ts", resolveDir: path.join(runCopy, "src"), sourcefile: `count-${entry.id}.ts`, contents: entrySource(entry.module, entry.export) },
  });
  return outfile;
}

/**
 * Run ONE real row through the real worker path (BENCH_CASE) of a counted bundle.
 * Returns { exit, failed, invocations: [counters...] } where invocation 0 is the pilot, 1-2 the warm-ups,
 * 3 the single measured sample. One child process, killed with SIGKILL after timeoutMs.
 */
export function runCounted(bundle, id, { pullCounts = false, timeoutMs = 180_000, env = {}, nodeArgs = [] } = {}) {
  const out = path.join(TMP, `count-run-${process.pid}-${Date.now()}.jsonl`);
  rmSync(out, { force: true });
  const child = spawnSync(process.execPath, ["--expose-gc", ...nodeArgs, bundle], {
    cwd: TMP,
    env: {
      ...process.env, TMPDIR: TMP, COUNT_OUT: out, COUNT_PULLCOUNTS: pullCounts ? "1" : "0",
      BENCH_CASE: id, BENCH_SAMPLES: "1", BENCH_PROFILE: "quick", BENCH_ROUNDS: "1",
      BENCH_IN_PROCESS: "", BENCH_SHARD: "", BENCH_FILTER: "", BENCH_SAMPLES_FILE: "", ...env,
    },
    encoding: "utf8", timeout: timeoutMs, killSignal: "SIGKILL", maxBuffer: 64 * 1024 * 1024,
  });
  const invocations = existsSync(out)
    ? readFileSync(out, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line))
    : [];
  rmSync(out, { force: true });
  return { exit: child.status, signal: child.signal, failed: child.status !== 0, stderr: (child.stderr ?? "").slice(-1500), invocations };
}

export function catalogOf(runCopy) {
  return JSON.parse(readFileSync(path.join(runCopy, "src/frameworkCatalog.json"), "utf8"));
}

// CLI: node lib/count-harness.mjs plan <runCopy> <plan.tsv> [rowsCsv]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === "plan") {
  const runCopy = path.resolve(process.argv[3]);
  const planFile = path.resolve(process.argv[4]);
  const rows = (process.argv[5] ?? "").split("|").filter(Boolean);
  const lines = [];
  for (const entry of catalogOf(runCopy)) {
    const bundle = await buildCounted(runCopy, entry);
    for (const row of rows) lines.push([bundle, entry.pullCounts ? "1" : "0", `${entry.name} :: ${row}`].join("\t")); // never an empty field: bash `read` collapses adjacent tabs
  }
  writeFileSync(planFile, lines.join("\n") + "\n");
  console.log(`built ${catalogOf(runCopy).length} counted bundles; ${lines.length} planned rows -> ${planFile}`);
}
