// COPY of neon's repro/repro-04-workloads-and-oracles.mjs (neon's audit folder is not included) with three changes: killSignal SIGKILL on its child; one non-ASCII dash in a comment replaced by "--"; the benchmark root (originally a hard-coded local path) is argv[2], else the repository root two levels above this folder. Timing numbers it prints are ignored (untimed merge). Not a protocol repro: it prints numbers.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const require = createRequire(path.join(root, "package.json"));
const esbuild = require("esbuild");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-repro-04-"));
const entry = path.join(tmpDir, "repro04.ts");

fs.writeFileSync(entry, `
import { perfTests } from "${root}/src/workloads";
import { Counter, makeGraph, runGraph } from "${root}/src/util/dependencyGraph";
import { expectedGraphSum } from "${root}/src/util/referenceGraph";
import { verifyBenchResult } from "${root}/src/util/perfTests";
import { makeFixture as makeCellxFixture } from "${root}/src/cellxBench";
import { ReactiveFramework } from "${root}/src/util/reactiveFramework";
import { alienFramework } from "${root}/src/frameworks/alienSignals";
import { anodFramework } from "${root}/src/frameworks/anod";
import { rescriptSignalsFramework } from "${root}/src/frameworks/rescriptSignals";
import { cellxFramework } from "${root}/src/frameworks/cellx";
import { kairoFramework } from "${root}/src/frameworks/kairo";
import { sFramework } from "${root}/src/frameworks/s";
import { solidFramework } from "${root}/src/frameworks/solid";
import { liteSignalFramework } from "${root}/src/frameworks/liteSignal";
import { SeededRandom } from "${root}/src/util/seededRandom";

// ============================================================
// 1. CHEATING MOCK ENGINES ON ALL 15 DYNAMIC WORKLOADS
// ============================================================
// Mock A: "Stale-until-last-read" engine.
// Serves stale initial values on EVERY intermediate read() during iterations,
// and ONLY computes true values on the very last read() (or on push, runs effects only once at end).
function makeStaleMock(): ReactiveFramework {
  // Actually simpler: a pure lazy uncached mock that returns 0 whenever read during writes
  // EXCEPT Wait: it doesn't know which read is final unless... wait! What about a mock that
  // caches initial value and ONLY recomputes every Kth read, or simply a mock that skips
  // invalidation until a sentinel? Better: in mixed mode, every iteration writes then calls read(),
  // and at the end runGraph calls return read()! Wait: even WITHOUT knowing when final read happens,
  // a mock that computes ONLY when tick >= finalTick (or a broken engine that only invalidates on
  // the last source write / stale cache bug that misses 99% of intermediate iterations) passes!
  // Let's test TWO realistic broken engines:
  // (a) StaleCacheBug: computes initial value, ignores all reads while dirty EXCEPT when read twice
  //     with same source version (which happens on the final extra return read() at dependencyGraph.ts:155!!).
  //     WAIT A SECOND! Because dependencyGraph.ts:148 calls read() AND line 155 calls return read()
  //     with NO write in between, ANY engine that lags by 1 read (returns stale on 1st read after write,
  //     fresh on 2nd read!) AUTOMATICALLY RETURNS THE EXACT RIGHT FINAL SUM ON LINE 155!!
  //     No magic oracle needed -- a genuine off-by-one stale-read bug!!
  const signals: { val: number; ver: number }[] = [];
  let globalVer = 0;
  return {
    name: "mock-lag-by-one-read",
    signal<T>(initial: T) {
      const s = { val: initial as any, ver: 0 };
      signals.push(s);
      return {
        read: () => s.val,
        write: (v: T) => { s.val = v as any; s.ver = ++globalVer; },
      };
    },
    computed<T>(fn: () => T) {
      let cached: T | undefined;
      let hasInit = false;
      let seenVer = -1;
      let dirtyReads = 0;
      return {
        read: () => {
          if (!hasInit) { hasInit = true; cached = fn(); seenVer = globalVer; return cached; }
          if (seenVer === globalVer) return cached!;
          // BUG: first read after any write returns STALE cached value!
          // Only a SECOND consecutive read at the same globalVer actually recomputes!
          dirtyReads++;
          if (dirtyReads === 1) return cached!;
          dirtyReads = 0;
          seenVer = globalVer;
          cached = fn();
          return cached;
        },
      };
    },
    effect: () => {},
    withBatch: (fn) => fn(),
    withBuild: (fn) => fn(),
  };
}

// Mock B: Double-evaluator bug (evaluates every computed TWICE per read)
function makeDoubleEvalMock(): ReactiveFramework {
  return {
    ...alienFramework,
    name: "mock-double-eval",
    computed: (fn) => {
      const inner = alienFramework.computed(() => {
        fn();
        return fn();
      });
      return inner;
    },
  };
}

console.log("=== 1. DYNAMIC WORKLOAD VERIFICATION GAPS (ALL 15 SCENARIOS) ===");
const staleMock = makeStaleMock();
const doubleMock = makeDoubleEvalMock();

for (const cfg of perfTests) {
  if (cfg.mode === "push" || cfg.mode === "pull") continue; // test mixed (13 scenarios) + pull below
  const checked = { ...cfg, expected: { ...cfg.expected } };
  checked.expected.sum ??= expectedGraphSum(cfg);

  // Test stale-by-one-read bug (genuinely serves STALE values on 100% of intermediate iterations!)
  const runMock = (fw: ReactiveFramework, testPullCounts: boolean) => {
    const counter = new Counter();
    const g = makeGraph(fw, cfg, counter);
    if (cfg.warmupIterations) {
      runGraph(g, { ...cfg, iterations: cfg.warmupIterations, startTick: 0 }, fw);
      counter.reset();
    }
    const sum = runGraph(g, { ...cfg, startTick: (cfg.warmupIterations ?? 0) * (cfg.updatesPerIteration ?? 1) }, fw);
    try {
      verifyBenchResult({ framework: fw, testPullCounts }, checked, { sum, count: counter.count });
      return \`PASS (count=\${counter.count})\`;
    } catch (e: any) {
      return \`FAIL (\${e.message.split(" ")[0]})\`;
    }
  };
  const sTrue = runMock(staleMock, true);
  const sFalse = runMock(staleMock, false);
  const dTrue = runMock(doubleMock, true);
  const dFalse = runMock(doubleMock, false);
  console.log(\`  \${cfg.name!.padEnd(28)} hasCount=\${String(cfg.expected.count !== undefined).padEnd(5)} | lag1(pull=T): \${sTrue.padEnd(22)} lag1(pull=F): \${sFalse.padEnd(22)} | dbl(pull=T): \${dTrue.padEnd(22)} dbl(pull=F): \${dFalse}\`);
}

// ============================================================
// 2. CELLX NO-OP EFFECT CHEAT + REAL TIMING COST OF UNVERIFIED EFFECTS
// ============================================================
console.log("\\n=== 2. CELLX1000 / CELLX2500 UNVERIFIED EMPTY EFFECTS ===");
const noOpEffectAlien: ReactiveFramework = {
  ...alienFramework,
  name: "alien-noop-effect",
  effect: () => {}, // COMPLETELY DROPS ALL 4,000 / 10,000 EFFECTS!
};
for (const layers of [1000, 2500]) {
  const fReal = makeCellxFixture(alienFramework, layers);
  const t0 = performance.now();
  alienFramework.withBatch(() => {
    fReal.start.prop1.write(4); fReal.start.prop2.write(3); fReal.start.prop3.write(2); fReal.start.prop4.write(1);
  });
  const realAfter = [fReal.end.prop1.read(), fReal.end.prop2.read(), fReal.end.prop3.read(), fReal.end.prop4.read()];
  const realMs = performance.now() - t0;
  fReal.dispose();

  const fCheat = makeCellxFixture(noOpEffectAlien, layers);
  const t1 = performance.now();
  noOpEffectAlien.withBatch(() => {
    fCheat.start.prop1.write(4); fCheat.start.prop2.write(3); fCheat.start.prop3.write(2); fCheat.start.prop4.write(1);
  });
  const cheatAfter = [fCheat.end.prop1.read(), fCheat.end.prop2.read(), fCheat.end.prop3.read(), fCheat.end.prop4.read()];
  const cheatMs = performance.now() - t1;
  fCheat.dispose();

  // Median of 20 runs for clean comparison
  const medRun = (fw: ReactiveFramework) => {
    const f = makeCellxFixture(fw, layers);
    const ts: number[] = [];
    for (let k = 0; k < 25; k++) {
      const a = k % 2 ? 4 : 1, b = k % 2 ? 3 : 2, c = k % 2 ? 2 : 3, d = k % 2 ? 1 : 4;
      const s = performance.now();
      fw.withBatch(() => { f.start.prop1.write(a); f.start.prop2.write(b); f.start.prop3.write(c); f.start.prop4.write(d); });
      f.end.prop1.read(); f.end.prop2.read(); f.end.prop3.read(); f.end.prop4.read();
      ts.push(performance.now() - s);
    }
    f.dispose();
    ts.sort((x, y) => x - y);
    return ts[12];
  };
  const realMed = medRun(alienFramework);
  const cheatMed = medRun(noOpEffectAlien);

  console.log(\`  cellx\${layers}: realAfter=\${JSON.stringify(realAfter)} cheatAfter=\${JSON.stringify(cheatAfter)} matches=\${JSON.stringify(realAfter) === JSON.stringify(cheatAfter)} | alien med=\${realMed.toFixed(3)}ms vs noop-effect med=\${cheatMed.toFixed(3)}ms (\${(realMed/cheatMed).toFixed(2)}x speedup with 0 effects!)\`);
}

// ============================================================
// 3. STABLE DIAMOND MESH TOPOLOGY & DUPLICATE EDGE ANALYSIS
// ============================================================
console.log("\\n=== 3. STABLE DIAMOND MESH TOPOLOGY AUDIT ===");
{
  const width = 512, sourcesCount = 256, totalLayers = 32, fanIn = 8;
  const clusterSize = Math.max(2, Math.floor(fanIn / 2)); // 4
  let totalEdges = 0, uniqueEdges = 0;
  // Track reachability from each source to layer 31
  const layerReach: Set<number>[][] = [];
  for (let layer = 0; layer < totalLayers; layer++) {
    const prevLen = layer === 0 ? sourcesCount : width;
    const rowSets: Set<number>[] = [];
    for (let nodeDex = 0; nodeDex < width; nodeDex++) {
      const clusterBase = (Math.floor(nodeDex / clusterSize) * clusterSize + layer * clusterSize) % prevLen;
      const parents: number[] = [];
      for (let sd = 0; sd < fanIn; sd++) {
        parents.push((clusterBase + Math.floor(sd / 2)) % prevLen);
      }
      totalEdges += parents.length;
      const uniq = new Set(parents);
      uniqueEdges += uniq.size;
      const srcSet = new Set<number>();
      for (const p of uniq) {
        if (layer === 0) srcSet.add(p);
        else for (const s of layerReach[layer - 1][p]) srcSet.add(s);
      }
      rowSets.push(srcSet);
    }
    layerReach.push(rowSets);
  }
  const leafSrcCounts = layerReach[totalLayers - 1].map(s => s.size);
  // Count how many nodes across ALL 32 layers are reachable from source 0
  let nodesReachableFromSrc0 = 0;
  for (let l = 0; l < totalLayers; l++) {
    for (let n = 0; n < width; n++) if (layerReach[l][n].has(0)) nodesReachableFromSrc0++;
  }
  // Distinct connected components (partition of leaves by their source sets)
  const distinctSrcSets = new Set(layerReach[totalLayers - 1].map(s => [...s].sort((a,b)=>a-b).join(",")));
  console.log({
    totalNodes: width * totalLayers,
    declaredFanIn: fanIn,
    totalEdges,
    uniqueEdges,
    duplicateEdgeFraction: \`\${(((totalEdges - uniqueEdges) / totalEdges) * 100).toFixed(1)}%\`,
    sourcesReachingEachLeaf_minMax: [Math.min(...leafSrcCounts), Math.max(...leafSrcCounts)],
    nodesReachableFromSource0: \`\${nodesReachableFromSrc0} / \${width * totalLayers} (\${(nodesReachableFromSrc0 / (width * totalLayers) * 100).toFixed(2)}%)\`,
    disconnectedSourceClusters: distinctSrcSets.size,
  });
}

// ============================================================
// 4. IEEE-754 PRECISION LOSS (> 2^53) & DYNAMIC NODE BIT-FREEZE
// ============================================================
console.log("\\n=== 4. IEEE-754 PRECISION LOSS (>2^53) & CORRUPTION SENSITIVITY ===");
for (const cfg of perfTests) {
  const sum = expectedGraphSum(cfg);
  const exceedsSafe = sum > Number.MAX_SAFE_INTEGER;
  if (exceedsSafe || cfg.staticFraction < 1) {
    // Also inspect max node value and whether any dynamic node has sum > 2^53 (or > 2^31)
    const { width, totalLayers, staticFraction, nSources, graphKind = "rect", sourcesCount = width, fanIn = nSources, updatesPerIteration = 1, warmupIterations = 0, measureBuild = warmupIterations === 0 } = cfg;
    const warmup = measureBuild ? 0 : warmupIterations;
    const writes = (warmup + cfg.iterations) * updatesPerIteration;
    let prev = Array.from({ length: sourcesCount }, (_, i) => i >= writes ? i : i + Math.floor((writes - 1 - i) / sourcesCount) * sourcesCount + i);
    const rng = new SeededRandom("seed");
    const layers = graphKind === "rect" ? totalLayers - 1 : totalLayers;
    let maxVal = 0, dynNodes = 0, dynOver2_31 = 0, dynOver2_53 = 0;
    for (let l = 0; l < layers; l++) {
      const size = graphKind === "rect" ? prev.length : width;
      const next = new Array(size);
      const inputCount = graphKind === "rect" ? nSources : fanIn;
      const step = Math.max(1, Math.floor(prev.length / Math.max(1, fanIn * 8)));
      const cluster = Math.max(2, Math.floor(fanIn / 2));
      for (let node = 0; node < size; node++) {
        const base = graphKind === "rect" ? node : graphKind === "layered-dag" ? node * 13 + l * 17 : Math.floor(node / cluster) * cluster + l * cluster;
        const isStatic = rng.float() < staticFraction;
        let s = prev[base % prev.length];
        if (!isStatic) {
          dynNodes++;
          if (s > 0x7fffffff) dynOver2_31++;
          if (s > Number.MAX_SAFE_INTEGER) dynOver2_53++;
        }
        const tailLength = inputCount - 1;
        const drop = graphKind === "rect" ? s % tailLength : tailLength === 0 ? 0 : (s + node) % tailLength;
        const shouldDrop = graphKind === "rect" ? s & 1 : (s + l + node) & 1;
        for (let input = 1; input < inputCount; input++) {
          if (!isStatic && shouldDrop && input - 1 === drop) continue;
          const offset = graphKind === "rect" ? input : graphKind === "layered-dag" ? input * step : Math.floor(input / 2);
          s += prev[(base + offset) % prev.length];
        }
        next[node] = s;
        if (s > maxVal) maxVal = s;
      }
      prev = next;
    }
    // Check if adding +1 to source[0] changes the final expectedGraphSum!
    let prevPert = Array.from({ length: sourcesCount }, (_, i) => i >= writes ? i : i + Math.floor((writes - 1 - i) / sourcesCount) * sourcesCount + i);
    prevPert[0] += 1;
    const rng2 = new SeededRandom("seed");
    for (let l = 0; l < layers; l++) {
      const size = graphKind === "rect" ? prevPert.length : width;
      const next = new Array(size);
      const inputCount = graphKind === "rect" ? nSources : fanIn;
      const step = Math.max(1, Math.floor(prevPert.length / Math.max(1, fanIn * 8)));
      const cluster = Math.max(2, Math.floor(fanIn / 2));
      for (let node = 0; node < size; node++) {
        const base = graphKind === "rect" ? node : graphKind === "layered-dag" ? node * 13 + l * 17 : Math.floor(node / cluster) * cluster + l * cluster;
        const isStatic = rng2.float() < staticFraction;
        let s = prevPert[base % prevPert.length];
        const tailLength = inputCount - 1;
        const drop = graphKind === "rect" ? s % tailLength : tailLength === 0 ? 0 : (s + node) % tailLength;
        const shouldDrop = graphKind === "rect" ? s & 1 : (s + l + node) & 1;
        for (let input = 1; input < inputCount; input++) {
          if (!isStatic && shouldDrop && input - 1 === drop) continue;
          const offset = graphKind === "rect" ? input : graphKind === "layered-dag" ? input * step : Math.floor(input / 2);
          s += prevPert[(base + offset) % prevPert.length];
        }
        next[node] = s;
      }
      prevPert = next;
    }
    const selRng = new SeededRandom("seed");
    const skip = Math.round(prevPert.length * (1 - cfg.readFraction));
    for (let i = 0; i < skip; i++) prevPert.splice(selRng.int(0, prevPert.length - 1), 1);
    const pertSum = prevPert.reduce((a, b) => a + b, 0);
    console.log(\`  \${cfg.name!.padEnd(28)} sum=\${sum.toExponential(4)} >2^53=\${String(exceedsSafe).padEnd(5)} +1_on_src0_detected=\${String(pertSum !== sum).padEnd(5)} dynNodes=\${dynNodes} (over2^31=\${dynOver2_31}, over2^53=\${dynOver2_53})\`);
  }
}

// ============================================================
// 5. LAYERED FULL-DRAIN COLD: BUILD VS RUN COUNTER SPLIT
// ============================================================
console.log("\\n=== 5. LAYERED FULL-DRAIN COLD: BUILD (UNTIMED) VS RUN (TIMED) ===");
const lfdcCfg = perfTests.find(t => t.name === "layered full-drain cold")!;
for (const fw of [liteSignalFramework, alienFramework, sFramework, solidFramework, anodFramework, rescriptSignalsFramework]) {
  fw.resetBenchmark?.();
  const c = new Counter();
  const t0 = performance.now();
  const g = makeGraph(fw, lfdcCfg, c);
  const buildMs = performance.now() - t0;
  const buildRecomp = c.count;
  const buildEdges = c.edgesTraversed;
  c.reset();
  const t1 = performance.now();
  runGraph(g, lfdcCfg, fw);
  const runMs = performance.now() - t1;
  console.log(\`  \${fw.name.padEnd(20)} build: \${String(buildRecomp).padStart(6)} recomp / \${String(buildEdges).padStart(6)} edges (\${buildMs.toFixed(1)}ms) | timed run: \${String(c.count).padStart(6)} recomp / \${String(c.edgesTraversed).padStart(7)} edges (\${runMs.toFixed(1)}ms)\`);
}

// ============================================================
// 6. WHY ANOD & RESCRIPT DO 2x ON PURE PULL, CELLX DOES 64x ON MESH, KAIRO DOES 780x ON PURE PULL
// ============================================================
console.log("\\n=== 6. COUNTER ANOMALIES: ANOD/RESCRIPT (PURE PULL), CELLX (MESH), KAIRO (PURE PULL) ===");
const pullCfg = perfTests.find(t => t.name === "pure pull")!;
for (const fw of [alienFramework, anodFramework, rescriptSignalsFramework, kairoFramework]) {
  const c = new Counter();
  const g = makeGraph(fw, pullCfg, c);
  const buildC = c.count;
  c.reset();
  runGraph(g, pullCfg, fw);
  console.log(\`  pure pull | \${fw.name.padEnd(20)} buildRecomp=\${buildC} runRecomp=\${c.count}\`);
}
// Check cellx on a tiny 1-source -> 1-computed -> 2-computed diamond WITHOUT effect
{
  let evals = 0;
  const s = cellxFramework.signal(1);
  const c1 = cellxFramework.computed(() => { evals++; return s.read() + 1; });
  const c2 = cellxFramework.computed(() => c1.read() + c1.read());
  c2.read();
  const afterFirst = evals;
  c2.read(); // read AGAIN with NO write!
  const afterSecondNoWrite = evals;
  console.log(\`  cellx unsubscribed computed caching check: after 1st read=\${afterFirst} evals, after 2nd read (NO write!)=\${afterSecondNoWrite} evals\`);
}
`);

const out = path.join(tmpDir, "repro04.cjs");
esbuild.buildSync({
  entryPoints: [entry],
  outfile: out,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  define: { "process.env.NODE_ENV": '"production"' },
});
const res = spawnSync(process.execPath, [out], { encoding: "utf8", timeout: 60_000, killSignal: "SIGKILL" });
console.log("Exit:", res.status);
console.log(res.stdout);
if (res.stderr) console.log("STDERR:", res.stderr);
fs.rmSync(tmpDir, { recursive: true, force: true });
