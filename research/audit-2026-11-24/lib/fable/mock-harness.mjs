// Runs a MOCK engine through upstream's REAL rows and REAL validation.
// The mock wraps upstream's own alien-signals adapter (a correct engine with all 51 rows) and
// injects exactly one fault, selected by MOCK_FAULT. MOCK_FAULT=none is the no-fault control.
// The bundle is built with the esbuild that is already installed in the target checkout (no install).
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCRATCH_ROOT, defaultTarget } from "../scratch.mjs";

export const AUDIT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TMP = path.join(SCRATCH_ROOT, "fable"); // outside the repository

export function resolveRunCopy(arg) {
  return arg ? path.resolve(process.cwd(), arg) : defaultTarget();
}

export const FAULTS = {
  none: "no fault (control)",
  "effect-never": "effect(fn) never runs fn",
  "effect-once": "effect(fn) runs fn once, untracked, and never again",
  "double-eval": "every computed body is evaluated twice per recomputation",
  "no-batch": "withBatch(fn) is just fn(): no batching, effects see intermediate states",
  "noop-dispose": "scope.dispose() and effect stop handles do nothing",
  "stale-toplevel-read": "a top-level computed read returns the value of the PREVIOUS top-level read (one-read lag)",
  "wrong-read-sporadic": "every 997th top-level computed read returns value + 1",
};

const ENTRY = `
import { alienFramework as base } from "./frameworks/alienSignals";
import { registerFrameworkBenchmarks } from "./suite";
import { runBenchmarks } from "./util/benchmark";
const fault = process.env.MOCK_FAULT ?? "none";
let depth = 0; // > 0 while a computed or effect body runs
let reads = 0;
const framework: any = {
  name: "mock",
  signal(v: any) {
    const s = base.signal(v);
    return { read: () => s.read(), write: (x: any) => s.write(x) };
  },
  computed(fn: () => any) {
    const body = () => {
      depth++;
      try {
        if (fault === "double-eval") fn();
        return fn();
      } finally {
        depth--;
      }
    };
    const c = base.computed(body);
    let last: any;
    let has = false;
    return {
      read() {
        const fresh = c.read();
        if (depth === 0) {
          if (fault === "wrong-read-sporadic" && ++reads % 997 === 0) return fresh + 1;
          if (fault === "stale-toplevel-read") {
            const out = has ? last : fresh;
            last = fresh;
            has = true;
            return out;
          }
        }
        return fresh;
      },
    };
  },
  effect(fn: () => void) {
    if (fault === "effect-never") return;
    if (fault === "effect-once") {
      depth++;
      try {
        fn();
      } finally {
        depth--;
      }
      return;
    }
    const stop = (base.effect as any)(() => {
      depth++;
      try {
        fn();
      } finally {
        depth--;
      }
    });
    return fault === "noop-dispose" ? () => {} : stop;
  },
  withBatch(fn: () => any) {
    if (fault === "no-batch") {
      fn();
      return;
    }
    base.withBatch(fn);
  },
  withBuild: (fn: () => any) => base.withBuild(fn),
  createScope(fn: () => any) {
    const scope = base.createScope!(fn);
    return fault === "noop-dispose" ? { value: scope.value, dispose() {} } : scope;
  },
};
registerFrameworkBenchmarks({ framework, testPullCounts: process.env.MOCK_PULLCOUNTS === "1" });
runBenchmarks().catch((error) => { console.error(error); process.exitCode = 1; });
`;

/** Bundle the mock entry against <runCopy>/src; returns the bundle path. */
export async function buildMock(runCopy) {
  mkdirSync(TMP, { recursive: true });
  const require = createRequire(path.join(runCopy, "package.json"));
  const { build } = require("esbuild");
  const outfile = path.join(TMP, "mock-bundle.cjs");
  await build({
    absWorkingDir: runCopy,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    conditions: ["production", "module"],
    define: { "process.env.NODE_ENV": '"production"' },
    outfile,
    logLevel: "silent",
    stdin: { loader: "ts", resolveDir: path.join(runCopy, "src"), sourcefile: "mock-entry.ts", contents: ENTRY },
  });
  return outfile;
}

/**
 * Run one fault through the real rows, in-process (BENCH_IN_PROCESS=1), 1 sample after the real
 * pilot + 2 warm-ups, with the real validate() after every invocation.
 * Returns Map(rowName -> { ok, kind, message }).
 */
export function runMock(bundle, { fault = "none", pullCounts = false, filter = "", timeoutMs = 600_000 } = {}) {
  const out = path.join(TMP, `mock-${fault}-${pullCounts ? "pc" : "nopc"}-${process.pid}.json`);
  rmSync(out, { force: true });
  const child = spawnSync(process.execPath, ["--expose-gc", bundle], {
    cwd: TMP,
    env: {
      ...process.env,
      TMPDIR: TMP,
      MOCK_FAULT: fault,
      MOCK_PULLCOUNTS: pullCounts ? "1" : "",
      BENCH_IN_PROCESS: "1",
      BENCH_SAMPLES: "1",
      BENCH_ALLOW_FAILURES: "1",
      BENCH_SAMPLES_FILE: out,
      BENCH_FILTER: filter,
      BENCH_CASE: "",
      BENCH_SHARD: "",
      BENCH_PROFILE: "quick",
      BENCH_ROUNDS: "1",
    },
    encoding: "utf8",
    timeout: timeoutMs,
    killSignal: "SIGKILL",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (child.error) throw child.error;
  if (!existsSync(out)) throw new Error(`mock ${fault}: no samples file (exit ${child.status}): ${child.stderr.slice(-800)}`);
  const json = JSON.parse(readFileSync(out, "utf8"));
  rmSync(out, { force: true });
  const rows = new Map();
  for (const row of json.rows)
    rows.set(row.name, row.status === "failed"
      ? { ok: false, kind: row.failure.kind, message: row.failure.message, group: row.group }
      : { ok: true, validation: row.validation, capped: row.capped === true, group: row.group });
  return rows;
}
