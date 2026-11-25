# Merge working notes (2026-11-24) -- kept for provenance; README.md is the deliverable
NOTE: the draft cluster ids below differ from the final ones; README.md numbering (D1-D7, Q1-Q20, X1-X19) is authoritative.

Inputs read (none of them is included in this folder): the audit brief, the earlier notes (2026-11-10), opus's
README (1-21 + L1-L9), fable's README (1-13, F1-F16, L1-L16, P1-P10, O1-O14), neon's FINDINGS F1-F15, README,
REPRO-LOG, IMPROVEMENTS (outline + section 1).

## Draft clusters (M = merged id)
D1 pure pull = whole pull group, no dirty read on lazy engines; graph built in timed call (opus 2, fable 1, neon F1(pull)+F8(pure pull)) 3/3
D2 core group "dynamic" = object publication, 2/3 rows never retrack (opus 6, fable 2, neon F1(dynamic)) 3/3
D3 cellx effects unobserved (opus 3, fable 3, neon F4.2) 3/3
D4 sample loop never yields -> fixtures retained (fable 4) 1/3
D5 Angular dev mode (fable 5) 1/3
D6 setup delivery failure reported as error (fable 6) 1/3
D7 doc counts 29 vs 30, reflex-quant missing from adapter docs (opus 5 DEFECT, fable F10 FACT) 2/3
Q1 molBench same-reference cut-off (opus 1 DEFECT, fable 7 QUESTION; KNOWN-M) 2/3 -> QUESTION (methodology.md:234-237 documents same-ref)
Q2 graph rows validate final pass only (opus 4 DEFECT, fable 11 QUESTION, neon F4.1; earlier note 2) 3/3 -> QUESTION (methodology.md:170, SEMANTICS.md:371-372); stale comment frameworkTypes.ts:17-19
Q3 group weights 1..10 rows (opus 7, fable 9, neon F1) 3/3
Q4 censoring drops scenario for all (opus 8, fable 8, neon F6.3) 3/3
Q5 censor ceilings order/VM dependent (fable 10, neon F6.1/F6.2/F6.3; opus 8 aside) 2/3
Q6 warm-up 2 invocations, drift (opus 9, fable 12, neon F3) 3/3
Q7 ranks 4-9 not separated (opus 10, neon F12.5, fable F5+P9) 3/3
Q8 dalien stack depth (opus 11) 1/3
Q9 TC39 3x getPending (opus 12, neon F14.1, fable L10) 2/3 + lead
Q10 layered cold 16384 (earlier note 3; opus P3, fable 13, neon F9) 3/3 reproduced, 0 blind
Q11 adapter bridge asymmetry (neon F2, fable L1) code CONFIRMED; magnitude PRELIMINARY
Q12 unobserved pull graphs (neon F8; fable L13, L14) partial
Q13 steady-mode setup garbage in timed windows (neon F7; fable F4 FACT) documented README.md:24
Q14 unsupervised pilot/warmup -> FAILED(timeout) (neon F6.4; opus L7) documented README.md:24/SEMANTICS.md:276
Q15 stable diamond mesh topology (neon F5; opus L6)
... neon-only: F4.3 ULP, F11 counters, F12.1-4 stats, F13 env, F14 adapters, F15 gauntlet, F10 anchors (FACT)

## Contradictions to resolve
C1 neon F10 vs opus 15 / fable F2,F3 -> code: hoist in round 1 only (benchmark.ts:617-629, documented README.md:24, SEMANTICS.md:260-264); data: no effect
C2 note 4 status
C3 neon F7 vs fable 4 vs opus 20
C4 molBench class
C5 graph-row validation class
C6 reflex-quant docs class
C7 neon F12.1 bestByRound flip vs opus FACT 16 -> compute (checks/)
C8 double-eval passing: neon F4 (defect) vs opus 17 / fable F9 (FACT)
C9 pure pull fix: opus warm (one read) vs fable read-per-commit

## Verification of neon-only items (so far)
- neon repro-01 + repro-02c re-run, cwd = a local clone at 12f169b, read-only (notes/neon-rerun/*.log): F1 weights + no-pure-pull ranks,
  F6.1 three ceilings on machine 2, F6.3 CPU censor rates, F9 233240/249624, F12.1 #4/#5 swap (1.6268 vs 1.6259/1.6269),
  F12.2 0/28, F12.3 coverages, F12.4 shard sd_machine, F15 gauntlet node v25.2.0 + versions, F7 spike buckets: all re-derived.
- code reading (the merge's verification checkout = git archive of 12f169b): F13 index.ts:14-29 + benchmark.ts:271-278, 1192-1195;
  F5 dependencyGraph.ts:368-387 (offsets 0,0,1,1,..; clusterBase multiple of 4); F11 0 'nodesRecomputed' in
  latest.samples.json, no counter handling in merge-shards.mjs; F14.2 angularSignals.ts:32-61; F14.3 kairo.ts:24;
  F14.4 cellx.ts:34-38 + node_modules/cellx/dist/cellx.js:635-639; F14.5 solid-signals.ts:156-172 (documented
  docs/adapter-audit.md:71-72); F2 preactSignals.ts:6-18 vs reflexQuant.ts:21-50, molWire.ts:8-16, adapter-audit.md:65-69;
  F6.2 benchmark.ts:631-657 (deferred decided after the whole round-1 order); F6.4 README.md:24, SEMANTICS.md:274-277.
- all 9 patches apply (patch --dry-run -p1) to the verification checkout.
- verification checkout: diff -rq vs git archive HEAD clean; build exit 0; dist/index.js sha256 47017675... (= opus, fable).
