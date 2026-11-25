// repro-tc39-drain: the TC39 adapter drains with `while (watcher.getPending().length) { for (s of watcher.getPending())
// s.get(); watcher.watch(); }` (src/frameworks/tc39-proposal-signals-stage-0.ts:18-30): 3 getPending() calls per
// non-empty commit; each call filters ALL watched producers and allocates 2 arrays (signal-polyfill dist getPending).
// The polyfill README effect pattern that docs/adapter-recheck.md:47-53 cites drains with one call per notification.
// Counted (untimed) on a manyEffectsFromOneSource-shaped graph (96 effects on 1 signal, 1000 commits).
// Control (one step differs): the same graph drained with a single getPending() per commit; effect runs must match.
import { main, runPath, bundle, runChild } from "../lib/opus/common.mjs";
main(async () => {
  const run = runPath();
  const file = await bundle(run, "tc39-drain", "probe", `
import { Signal } from "@RUN@/node_modules/signal-polyfill";
const W: any = (Signal as any).subtle.Watcher.prototype;
const orig = W.getPending; let calls = 0, scanned = 0;
W.getPending = function () { calls++; const r = orig.call(this); scanned += (this as any)[Object.getOwnPropertySymbols(this)[0]]?.producerNode?.length ?? 0; return r; };
import { tc39SignalsProposalStage0 as fw } from "@RUN@/src/frameworks/tc39-proposal-signals-stage-0";
const N = 96, COMMITS = 1000;
let runs = 0;
const s = fw.signal(0);
for (let i = 0; i < N; i++) fw.effect(() => { s.read(); runs++; });
runs = 0; calls = 0; scanned = 0;
for (let v = 1; v <= COMMITS; v++) fw.withBatch(() => s.write(v));
const adapter = { calls: calls / COMMITS, scannedPerCommit: scanned / COMMITS, effectRunsPerCommit: runs / COMMITS };
// control: README-style single drain on a separate watcher
let cruns = 0; calls = 0; scanned = 0;
const w = new (Signal as any).subtle.Watcher(() => {});
const cs = new Signal.State(0);
for (let i = 0; i < N; i++) { const c = new Signal.Computed(() => { cs.get(); cruns++; }); w.watch(c); c.get(); }
cruns = 0; calls = 0; scanned = 0;
for (let v = 1; v <= COMMITS; v++) { cs.set(v); for (const p of w.getPending()) p.get(); w.watch(); }
const control = { calls: calls / COMMITS, scannedPerCommit: scanned / COMMITS, effectRunsPerCommit: cruns / COMMITS };
console.log(JSON.stringify({ adapter, control }));
`);
  const r = runChild(file);
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  if (o.control.effectRunsPerCommit !== o.adapter.effectRunsPerCommit || o.control.calls !== 1) throw new Error("control mismatch: " + JSON.stringify(o));
  return { reproduced: o.adapter.calls >= 2 * o.control.calls, line: `per commit: adapter getPending() calls=${o.adapter.calls}, producers scanned=${o.adapter.scannedPerCommit}; control calls=${o.control.calls}, scanned=${o.control.scannedPerCommit}; effect runs equal (${o.adapter.effectRunsPerCommit}). signal-polyfill installed 0.2.2 vs locked 0.2.3 (VERSION-SENSITIVE for scan cost, not for the call count).` };
});
