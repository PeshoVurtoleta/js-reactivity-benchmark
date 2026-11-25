// A small, correct push-pull reactive engine (reactively-style CLEAN/CHECK/DIRTY colouring,
// lazy computeds with Object.is cut-off, effects flushed at the outermost batch), wrapped as a
// ReactiveFramework for the upstream harness. MOCK_FAULT selects one injected fault:
//   none | stale | skipEffects | double | noopDispose | wrong | noCutoff | dropBatchWrite | effectNoTrack
// Counters (evaluations, effect runs) are exposed on globalThis.__mockCounts for probes.
// Type-only in the source audit (stripped by esbuild); the upstream type is <run>/src/util/reactiveFramework.ts.
type ReactiveFramework = any;

const FAULT = (globalThis as any).process?.env?.MOCK_FAULT ?? "none";
const counts = ((globalThis as any).__mockCounts = { evals: 0, effects: 0, writes: 0, retracks: 0,
  timedCreates: 0, timedFirstEvals: 0, timedReEvals: 0, timedWrites: 0, timedUnobservedWrites: 0, timedEffectRuns: 0, timedInvocations: 0 });
const T = () => (globalThis as any).__timed === true;

const CLEAN = 0, CHECK = 1, DIRTY = 2;
type Node = {
  fn?: () => any;
  value: any;
  state: number;
  sources: Node[];
  observers: Set<Node>;
  effect: boolean;
  disposed: boolean;
  evaluated: boolean;
};

let current: Node | null = null;
let batchDepth = 0;
const queue: Node[] = [];
let owner: Node[] | null = null;
let evalSerial = 0;

function mk(fn: (() => any) | undefined, value: any, effect: boolean): Node {
  const n: Node = { fn, value, state: fn ? DIRTY : CLEAN, sources: [], observers: new Set(), effect, disposed: false, evaluated: false };
  if (owner && fn) owner.push(n);
  if (T()) counts.timedCreates++;
  return n;
}
function track(n: Node) {
  if (current && !current.disposed && !(FAULT === "effectNoTrack" && current.effect)) {
    if (!current.sources.includes(n)) current.sources.push(n);
    n.observers.add(current);
  }
}
function mark(n: Node, state: number) {
  for (const o of n.observers) {
    if (o.state < state) {
      const was = o.state;
      o.state = state;
      if (o.effect && was === CLEAN) queue.push(o);
      mark(o, CHECK);
    }
  }
}
function evaluate(n: Node) {
  if (n.disposed) return;
  if (FAULT === "stale" && n.evaluated && !n.effect) { n.state = CLEAN; return; }
  const before = n.sources;
  for (const s of n.sources) s.observers.delete(n);
  n.sources = [];
  const prev = current;
  current = n;
  let v;
  try {
    counts.evals++;
    if (n.effect) counts.effects++;
    if (T()) { if (n.effect) counts.timedEffectRuns++; else if (n.evaluated) counts.timedReEvals++; else counts.timedFirstEvals++; }
    v = n.fn!();
    if (FAULT === "double" && !n.effect) { counts.evals++; v = n.fn!(); }
    if (FAULT === "wrong" && !n.effect && typeof v === "number" && ++evalSerial % 997 === 0) v = v + 1;
  } finally {
    current = prev;
  }
  if (n.evaluated && (before.length !== n.sources.length || before.some((s) => !n.sources.includes(s)))) counts.retracks++;
  n.evaluated = true;
  const changed = FAULT === "noCutoff" ? true : !Object.is(v, n.value);
  n.value = v;
  n.state = CLEAN;
  if (changed && !n.effect) for (const o of n.observers) { if (o.state !== DIRTY) { if (o.effect && o.state === CLEAN) queue.push(o); o.state = DIRTY; } }
}
function update(n: Node) {
  if (n.state === CHECK) {
    for (const s of n.sources) {
      if (s.fn) update(s);
      if ((n.state as number) === DIRTY) break;
    }
  }
  if (n.state === DIRTY) evaluate(n);
  n.state = CLEAN;
}
function flush() {
  if (FAULT === "skipEffects") { queue.length = 0; return; }
  while (queue.length) {
    const e = queue.shift()!;
    if (!e.disposed) update(e);
  }
}
function write(n: Node, v: any) {
  if (FAULT === "dropBatchWrite" && batchDepth > 0 && ++evalSerial % 7 === 0) return;
  if (Object.is(n.value, v)) return;
  counts.writes++;
  if (T()) { counts.timedWrites++; if (n.observers.size === 0) counts.timedUnobservedWrites++; }
  n.value = v;
  mark(n, DIRTY);
  // direct observers DIRTY, rest CHECK
  for (const o of n.observers) o.state = DIRTY;
  if (batchDepth === 0) flush();
}
function dispose(n: Node) {
  n.disposed = true;
  for (const s of n.sources) s.observers.delete(n);
  n.sources = [];
}

class SignalNode { constructor(public n: Node) {} read() { track(this.n); return this.n.value; } write(v: any) { write(this.n, v); } }
const lagged = new WeakSet<Node>();
class ComputedNode { constructor(public n: Node) {} read() { track(this.n); if (this.n.state !== CLEAN) { if ((FAULT === "lagRead" || (FAULT === "lagSinkRead" && current === null)) && this.n.evaluated && !lagged.has(this.n)) { lagged.add(this.n); return this.n.value; } lagged.delete(this.n); update(this.n); } return this.n.value; } }

export const mockFramework: ReactiveFramework = {
  name: "mock-" + FAULT,
  signal: (v) => new SignalNode(mk(undefined, v, false)) as any,
  computed: (fn) => new ComputedNode(mk(fn, undefined, false)) as any,
  effect: (fn) => {
    const n = mk(fn, undefined, true);
    update(n);
    return (() => dispose(n)) as any;
  },
  withBatch: (fn) => {
    batchDepth++;
    try { fn(); } finally { batchDepth--; }
    if (batchDepth === 0) flush();
  },
  withBuild: (fn) => fn(),
  createScope: (fn) => {
    const prevOwner = owner;
    const nodes: Node[] = [];
    owner = nodes;
    let value;
    try { value = fn(); } finally { owner = prevOwner; }
    return { value, dispose: () => { if (FAULT !== "noopDispose") nodes.forEach(dispose); } };
  },
};
