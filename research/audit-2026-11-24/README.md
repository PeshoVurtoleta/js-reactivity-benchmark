# js-reactivity-benchmark (12f169b) -- merged audit findings

Three independent audits of [js-reactivity-benchmark](https://github.com/volynetstyle/js-reactivity-benchmark)
(Andrii Volynets, MIT), merged and deduplicated, and written for the benchmark's author. Every DEFECT and every
scripted QUESTION has a script in `repro/` that reproduces it against this repository; 9 come with a patch in
`patches/`. The patches show that a fix exists and what it touches; which meaning a row should have is the
author's decision, and two of them (D1) are alternatives.

| | |
|---|---|
| Date | audits and merge 2026-11-24; this folder assembled and re-verified 2026-11-25 |
| AUDIT COMMIT | `12f169b0f7d25de343433e3199c27d0472136185` (upstream `main` HEAD when read on 2026-11-24 by opus and fable; no later commit) |
| RESULTS SOURCE COMMIT | `f0d456c45b12c7f4b9a42138337e867503a6581b` (`sourceCommit` of `bench-results/latest.samples.json`; f0d456c..12f169b touches only `bench-results/` and `index.html`) |
| Merge | by opus (Claude Opus 5.5) in a separate session on 2026-11-24, reading the three audits after all three were finished; no timed runs |
| Verification | 2026-11-25, `node run-all.mjs` from this folder against a built `git archive` of 12f169b: see "Verification" and `run-all.log` |

Sources (the three audit folders are not included; this folder holds the merged findings, the protocol scripts
that back them, their shared helpers, the patches, and the re-runs of neon's scripts):

| tag | model / effort (as each audit records it) | scope | timing |
|---|---|---|---|
| `neon` | not recorded in its folder | F1-F15 (FINDINGS), IMPROVEMENTS, 13 probe scripts that do NOT follow the exit-code protocol (they print numbers; three were re-run for the merge, `notes/neon-rerun/`) | several local A/B timings on a busy host: every timing number of neon is PRELIMINARY |
| `opus` | Claude Opus 5.5, default effort, 3 read-only sub-agents | findings 1-12, FACTS 13-21, leads L1-L9, proposals P1-P7, observations O1-O10; 16 protocol repros; 4 patches | none |
| `fable` | Claude Fable 5.2, reasoning effort 80, 6 read-only sub-agents | findings 1-13, FACTS F1-F16, leads L1-L16, proposals P1-P10, observations O1-O14; 13 protocol repros; 7 patches | one 81 s interleaved A/B (Angular), PRELIMINARY (host load about 9.5) |

Independence: opus and fable wrote their own findings blind and opened the earlier notes (four items the
lite-signal maintainer wrote on 2026-11-10 against fb10dd9; not included, each is re-checked in "Earlier notes"
below) and KNOWN-M (a statement about molBench given to the auditors in their brief) only in their Phase 3,
after their own findings were on disk. neon had the earlier notes from the start. So an earlier-note item
found by neon is not independent evidence, and the AGREEMENT column counts "found independently" only for
opus and fable on those items.

Script names such as `repro-pure-pull.mjs` in the per-finding lines are the auditors' own scripts (not
included); the scripts in `repro/` are the merged copies, named after the merged ids. No number in this README
is a timing taken by this audit unless it is marked PRELIMINARY; every verification run here is untimed.

## Environment and reproduction

Every value below was printed by a command on the audit host; none is typed from memory.

**Revisions** (this repository):

| what | value | command |
|---|---|---|
| audited commit | `12f169b0f7d25de343433e3199c27d0472136185` (2026-11-16, "chore: update benchmark results"), package.json version `4.0.0` | `git log -1 12f169b`; `git show 12f169b:package.json` |
| results source commit | `f0d456c45b12c7f4b9a42138337e867503a6581b` | `sourceCommit` in `bench-results/latest.samples.json` |
| between the two | only `bench-results/` and `index.html` | `git diff --stat f0d456c 12f169b` |

**Published board** (fields of `bench-results/latest.samples.json`): node `v24.15.0`, V8 `13.6.233.17-node.48`,
`linux/x64`, profile `quick`, 8 scenario shards x 3 machine rounds x 3 process rounds on GitHub-hosted VMs,
`lockfileSha256` `f9b63c4b...`, `bundleSha256` `66d2d2ca...`. `.nvmrc` is `24.15.0`.

**Audit host:**

| what | value | command |
|---|---|---|
| Node | `v26.8.2` | `node -v` |
| V8 | `14.6.202.34-node.28` | `node -p process.versions.v8` |
| OS / CPU | `Darwin arm64`, Apple M4 Pro | `uname -sm`; `sysctl -n machdep.cpu.brand_string` |
| esbuild | `0.28.2` (the repository's own; the scripts bundle their probes with it) | `node_modules/esbuild/package.json` |
| `dist/index.js` after `node scripts/build.mjs` | sha256 `47017675401befdc7c01e1d3e142be7c1170f20b4e5aca40d62f4610b93ea0ad` (the same in both auditors' copies, the merge's and this folder's checkout) | `shasum -a 256 dist/index.js` |

The corpus was run on node v26.8.2 (Q8 also checked MobX on 24.15.0). Q8 depends on the host's default stack
size, so its result can differ elsewhere; the script prints what it saw.

**Installed packages.** The audit host's `node_modules` was not a fresh `pnpm install --frozen-lockfile`: these
installed versions differ from `package.json` / `pnpm-lock.yaml` (checked by comparing each
`node_modules/<name>/package.json` version with the pinned version):

| package | pinned | installed on the audit host |
|---|---|---|
| @angular/core | 22.2.6 | 22.2.5 |
| @pravosleva/reactive-engine | 3.0.0 | 2.6.3 |
| mobx | 7.1.7 | 7.1.5 |
| mol_wire_lib | 1.0.1846 | 1.0.1837 |
| reflex-quant | 1.2.0 | 1.1.1 |
| signal-polyfill | 0.2.3 | 0.2.2 |
| solid-js | 1.9.19 | 1.9.18 |
| vite (dev) | 8.3.8 | 8.3.6 |
| vitest (dev) | 5.1.0 | 5.0.5 |

Findings that depend on a version say so (VERSION-SENSITIVE: D5, Q8, Q9, L-M1, L-M7). The published
samples, which most QUESTIONS and FACTS read, are independent of the local install. With the locked versions,
the scripts that run real adapters (D1, D2, D4, D5, Q1, Q8, Q9, Q10) may print different numbers; the corpus
was not run on a frozen-lockfile install.

**Commands.** Build the repository first, from its root:

```bash
pnpm install --frozen-lockfile     # the locked versions (see the table above)
pnpm build                         # = node scripts/build.mjs: dist/index.js and the 30 worker bundles
```

Then, from this folder (`research/audit-2026-11-24/`):

```bash
# all 20 scripts, one at a time, against the repository two levels up
# (about 2 minutes on the lightly loaded audit host, 12 on a busy one; q2 takes most of it)
node run-all.mjs

# the same against another built checkout (argument, or the AUDIT_TARGET environment variable)
node run-all.mjs /path/to/other/checkout

# a subset
ONLY=d1-pull-group-no-dirty-reads,q8-stack-depth node run-all.mjs

# one script (same default target; a checkout path may be passed as the first argument)
node repro/d1-pull-group-no-dirty-reads.mjs

# the untimed re-derivation of neon-only numbers (prints numbers; exit 0, or 2 on error)
node checks/check-neon-published.mjs
```

Nothing is written into the repository: bundles, child `TMPDIR` and each script's full output go to a fresh
directory under `os.tmpdir()`. `run-all.mjs` keeps its directory (named in its header, full path on stderr);
a script run by hand removes its own on exit. `run-all.mjs` prints a header (checkout, `dist/index.js` sha256,
the results source commit, node, V8, platform, load average) before the verdicts.

**Exit convention.** Every script in `repro/` exits 1 only after a line starting `REPRODUCED`, 0 only after a
line starting `NOT REPRODUCED`, 2 on anything else (an `ERROR` line: import failure, unexpected result, or a
failed control). `run-all.mjs` prints `<slug> <exit>`, and reports any other combination (exit 1 without a
`REPRODUCED` line, exit 0 without a `NOT REPRODUCED` line, a kill by its 20-minute SIGKILL timeout, any other
code) as CRASHED, never as a verdict. Three scripts (`x1`-`x3`) check FACTS and earlier notes: for them NOT
REPRODUCED (exit 0) is the expected result.

**Patches.** Each patch is made against 12f169b on its own. From the repository root:

```bash
git apply --check research/audit-2026-11-24/patches/<name>.diff
git apply research/audit-2026-11-24/patches/<name>.diff
pnpm build                          # then re-run the finding's script: its author recorded NOT REPRODUCED
```

The two D1 patches both edit `src/workloads.ts` and are alternatives (apply one). Combinations of patches were
not tested. All 9 apply cleanly to 12f169b (checked with `patch --dry-run -p1`); their proofs are their
authors' (on their own copies) and were not re-run for this folder, which made no patched build.

**No-fault controls.** Every script runs its control in the same process, against the same checkout. A failed
control throws, so the script exits 2 (`ERROR`) and `run-all.mjs` shows 2: no script can report REPRODUCED
past a failed control. The fable-derived scripts (`lib/fable/repro.mjs`) print each control as
`control: <text>: ok`; the opus-derived scripts (`lib/opus/common.mjs`) print theirs inside the verdict line.

| script | control (what it changes or checks) |
|---|---|
| `d1-pull-group-no-dirty-reads` | the same row built with the sinks read after every write (`mode: "mixed"`): passes the same sum validation and does dirty re-evaluations and per-iteration sink reads; the real row passes its validation on alien-signals and s-js |
| `d2-dynamic-group-no-churn` | the unscored `dynamic/dynamic component` (dynamic nodes): the counter sees dependency churn there (107); each real row passes its validation |
| `d3-cellx-effects` | the correct engine passes every selected row; the same fault (`skipEffects`) FAILS `diamond` (delivery-probed) |
| `d4-sync-loop-retains-fixtures` | alien-signals and Preact Signals: flat heap; tansu and Svelte with one microtask checkpoint before each sample: flat heap |
| `d5-angular-dev-mode` | the same worker built with `ngDevMode: "false"`: no dev global, no per-node debug closure; both builds compute the same value |
| `d6-setup-failure-kind` | the no-fault mock passes; a wrong value found by `entry.validate` (`dynamic/pure push`) is labelled `incorrect` |
| `d7-adapter-docs` | every other active engine appears in the README adapter table |
| `q1-molbench-cutoff` | D returns a fresh array (the pre-d4c5ffc form): F runs (checked for alien-signals); skipped with a note on a tree that already returns a fresh array |
| `q2-dynamic-rows-final-state-only` | the no-fault mock passes all 15 rows with pull counts asserted; both read faults are caught by `updateComputations1to1`, a row that checks every read |
| `q3-score-weights` | the independent scorer reproduces the published board (29 ranked, reflex-quant first); inside one group (update, 7 rows) balanced and flat aggregation give the same order |
| `q4-censor-exclusion` | a 10% slowdown of a measured row worsens the score |
| `q5-censor-order-dependent` | in every (VM, scenario) cell with ONE ceiling, no measured probe is above it |
| `q6-warmup-drift` | the 7 long update rows sit within 3% of their own last-quarter level |
| `q7-rank-sensitivity` | ranks 1-3 and 10-13 do not move under any of the 6 scorings |
| `q8-stack-depth` | alien-signals passes cellx2500 with the default stack |
| `q9-tc39-drain` | the same graph drained with a single `getPending()` per commit: 1 call, same effect runs |
| `q10-layered-cold-setup-work` | the same graph, warm: every engine does the same number of evaluations; each real row passes its validation |
| `x1-score-recompute` | lite-signal's core rows x1.2: its rank must drop (8 -> 11) |
| `x2-capped-label` | a forged label mismatch is detected |
| `x3-gc-before-sample` | the creation rows are still `cold` |

**Process budget.** `run-all.mjs` waits (`spawnSync`) on one script, which waits on at most one child at a
time; for `q8-stack-depth` that child is the repository's runner, which forks one worker. At most one or two
node processes work at once; up to three (four during q8) are alive, counting idle parents.

---

## Executive summary

- The arithmetic is right: two independent re-implementations of the scorer (opus, fable) reproduce all 29
  published ranks and scores exactly, and neon's re-scoring agrees.
- What the board measures is the problem, not how it adds. The single row `dynamic/pure pull` is the whole
  `pull` group, so it carries 16.7% of every score (a creation row carries 1.7%), and on a lazy engine it does
  no dirty read at all: it times graph construction plus 10,000 writes nobody observes. Removing that one row
  changes 23 of 29 ranks (s-js #22 -> #9). The core group called `dynamic` is two object-publication rows and
  molBench, none of which churns dependencies in the way the group is described.
- Validation has holes no current engine is shown to exploit: the cellx rows never check that any of their
  4,000 / 10,000 effects ran, and the 15 dependency-graph rows check only the final sink pass.
- Measurement choices that move ranks: censoring one slow engine removes a core scenario for everybody (both
  fan-out push rows are gone from this board), two warm-up invocations leave short rows drifting while sampled,
  and ranks #4 to #9 swap under every other defensible estimator or aggregation.
- Single-auditor defects with proven patches: the sample loop never yields to the event loop, so five engines
  keep every earlier fixture alive; the Angular worker runs Angular's development mode; a wrong result found
  during setup is reported as a crash.
- 7 DEFECTS, 20 QUESTIONS, 19 FACTS after merging (counts by agreement in "Merged finding counts" below).

## Conflict of interest

The maintainer of @zakkster/lite-signal commissioned all three audits. lite-signal is **#8 of 29** on the
published board (score 1.910), **0.3% ahead of #9 rescript-signals** (1.916); same-day replicate runs of the
board differ by up to 2.7% in score (fable F5), so #8 versus #9 is inside replication noise.

Every finding states its LITE-SIGNAL EFFECT. Both opus and fable found, independently, that **nearly every
alternative they computed moves lite-signal from #8 to #9, and none moves it above #8**:

| Counterfactual computed from the published samples | lite-signal | source |
|---|---|---|
| molBench excluded (Q1) | 8 -> 9 | opus 1, fable 7 |
| censored scenarios kept (Q4) | 8 -> 9 | opus 8, fable 8 |
| flat geometric mean instead of group-balanced (Q3) | 8 -> 9 | opus 7, fable 9 |
| median of each process's last half (Q6) | 8 -> 9 | opus 9/10, fable 12 |
| dalien-signals' stack overflow treated as a censored row (Q8) | 8 -> 9 | opus 11 |
| group `dynamic` dropped (D2; the proposed fix is a rename, which moves nothing) | 8 -> 9 | fable 2 |
| six alternative scorings (Q7) | 8 or 9 | opus 10 |
| `dynamic/pure pull` removed (D1) | stays 8 | opus 2, fable 1 |
| any patch that changes what a row times (D1, Q1, D4) | unknown without a measured run | all |

Two further items concern lite-signal's own adapter and are listed because the conflict requires it: the
adapter uses `prealloc: "lazy"`, which keeps pool growth inside the timed creation rows (documented in
`src/frameworks/liteSignal.ts:5-14`; opus FACT 20 and fable F13 find it not tuned in lite's favour; fable notes
from lite's own bench audit that a different configuration would move lite UP in the creation group, UNVERIFIED here); and
neon F7 reports that lite's per-setup registry reset allocates about 2.2 MB on `cellx1000` (UNVERIFIED here).
The fix that lite's own mirror inherits (molBench, Q1) moves lite DOWN.

---

## Merged finding counts

| class | 3/3 | 2/3 | 1/3 | mixed | total |
|---|---|---|---|---|---|
| DEFECT | 3 (D1, D2, D3) | 1 (D7) | 3 (D4, D5, D6) | - | 7 |
| QUESTION | 6 (Q2, Q3, Q4, Q6, Q7, Q10) | 7 (Q1, Q5, Q9, Q11, Q12, Q13, Q15) | 6 (Q8, Q14, Q16, Q17, Q18, Q20) | 1 (Q19) | 20 |
| FACT | | | | | 19 (X1-X19) |

An auditor counts toward AGREEMENT when it reproduced, re-derived or (for 2/3 items marked so) raised the item
as a code-reading lead; "found independently" is stated per item. Q2 and Q10 are earlier notes
2 and 3 (2026-11-10): opus and fable each found Q2 blind; nobody found Q10 blind (opus and fable reproduced it in Phase 3,
neon worked from the notes). Q19 is a bundle of five adapter details found by one or two auditors each.
Of the 27 DEFECT + QUESTION items, 9 rest on 3/3, 8 on 2/3, 9 on one auditor, 1 is mixed.

Slugs in `repro/` start with the merged id (`d1-...`, `q1-...`; `x1-x3` are the FACT and earlier-note checks).

---

## DEFECTS (break a written upstream claim, or print a wrong label / number / check result)

### D1. The `pull` group is one row, and on a lazy engine that row does no dirty read; the graph is built on the clock

`node repro/d1-pull-group-no-dirty-reads.mjs` (fable's repro; opus's `repro-pure-pull.mjs` shows the same with a counting mock through the real runner)

| | |
|---|---|
| SOURCES | opus 2, fable 1, neon F1 (the `pull` part) and F8 (pure pull is unobserved) |
| AGREEMENT | 3/3; opus and fable blind; neon framed it under weighting (Q3) |
| Class | DEFECT (opus and fable agree) |

Evidence (fable, real worker path, counters cover exactly the timed statement):

| per timed invocation | alien-signals (lazy) | control: same row, `mode: "mixed"` (sinks read per write) | s-js (eager) |
|---|---|---|---|
| batched writes | 10000 | 10000 | 10000 |
| sink reads | 32 | 320032 | 32 |
| nodes created in the timed region | 224 first evaluations | 224 | 224 |
| dirty re-evaluations | 0 | 909909 | 909909 |

opus (mock engine through the real runner): 256 nodes created, 224 first evaluations, 0 dirty re-evaluations and
9999 / 9999 writes to signals nobody observes per timed call; control `warmupIterations: 1`: 0 created, 224 dirty
re-evaluations, 0 unobserved writes. Published `nodesRecomputed` agrees: 224 for 22 frameworks, 448 for anod and
rescript-signals, 174752 for kairo, 910133 for s-js and the four Solid-family engines (SolidJS, @solidjs/signals,
both 2 RC builds).

Claims broken: group `pull` = "dirty reads, aggregation, and chain pulls" (`README.md:188`), "Dirty computed reads,
fan-in aggregation, and chain pulls" (`SEMANTICS.md:209`); "Preparation ... stay outside timing" (`README.md:24`):
`measureBuild` defaults to true when `warmupIterations` is 0 (`src/dynamicBench.ts:25-26`, `:86-88`), so
construction is timed. Cause: `src/util/dependencyGraph.ts:144-155` (mode `pull`: writes in the loop, one read at
the end; the cadence itself is documented at `docs/benchmark-methodology.md:167`), `src/workloads.ts:113-126`,
`src/dynamicBench.ts:37-42`. History (fable, web, read 2026-11-24): the no-read pull mode arrived with d4c5ffc
(2026-04-17); both ancestors read the leaves on every iteration.

IMPACT: all 29 ranked frameworks; the row is 1/6 of every score. Without it 23 of 29 ranks change (s-js #22 -> #9,
Svelte v5 #24 -> #28, uSignal #14 -> #17, $mol_wire #17 -> #20, alien-signals and reflex swap #2 / #3); eager
engines do about 4000x the evaluations of lazy ones in a row named after pulling. neon's numbers agree (s-js +13
places, score -62%; re-derived by the merge's re-run of neon's repro-01).

LITE-SIGNAL EFFECT: none by rank if the row is removed (#8, 1.910 -> 1.820). With either patch: unknown sign
without a measured run (opus: probably down, since lite pays nothing per write today).

Fix (two different, both proven on a copy; they answer different questions, so both are kept):
- `patches/d1-pure-pull-warm.diff` (opus): `warmupIterations: 1`, sum from upstream's oracle, old count dropped.
  Takes construction off the clock (C1) and makes the final read a dirty read. Proof: repro NOT REPRODUCED on the
  patched copy; all 30 adapters pass the patched row (BENCH_SAMPLES=1). Side effect: $mol_wire then recomputes
  910,000 nodes (lead L-M1).
- `patches/d1-pull-mode-reads-each-commit.diff` (fable): mode `pull` reads the sinks after every commit (count
  910133; methodology table updated). Makes the row a real dirty-read row. Proof: 909909 dirty re-evaluations,
  320032 sink reads, row passes its own sum and count, repro NOT REPRODUCED, upstream's 1093 tests pass.
- Either way the one-row group weight is a separate question (Q3).

### D2. The core group `dynamic` scores object publication; 2 of its 3 rows never change a dependency set

`node repro/d2-dynamic-group-no-churn.mjs` (fable; opus `repro-dynamic-group-label.mjs` agrees)

| | |
|---|---|
| SOURCES | opus 6, fable 2, neon F1 (the `dynamic` part) |
| AGREEMENT | 3/3; opus and fable blind |
| Class | DEFECT (all agree) |

| row (core group `dynamic`) | dependency-set changes per timed run (fable / opus) |
|---|---|
| mutable-object/immutable replacement | 0 / 0 |
| mutable-object/in-place versioned | 0 / 0 |
| molBench | 2 / 2 (G toggles its read of E) |
| control `dynamic/dynamic component` (stress, unscored) | 107 / 107 |

Claim broken: `dynamic` = "branch switching, dependency cleanup, and retracking" (`README.md:190`), "Dependency
churn, branch switching, cleanup, and retracking" (`SEMANTICS.md:211`). Cause: `src/util/benchmark.ts:235-245`
maps `mutable-object/*` and `molBench` to `["dynamic", "object publication"]`; every churn graph is `large_graph`
(stress) by `src/dynamicBench.ts:37-42`.

IMPACT: a label on 16.7% of the score; renaming changes no number. Dropping the group would change 10 ranks.
LITE-SIGNAL EFFECT: none for the rename (dropping the group: #8 -> #9).

Fix: `patches/d2-publication-group-label.diff` (fable): group `publication` with an accurate description; README
and SEMANTICS follow. Proof: tsc clean, upstream tests pass, repro NOT REPRODUCED. A group that really measures
churn needs new core rows (fable P6, neon IMPROVEMENTS 2.3).

### D3. The cellx rows create 4,000 / 10,000 effects and never check that one of them ran

`node repro/d3-cellx-effects.mjs` (opus; fable `repro-cellx-effects-unobserved.mjs` agrees)

| | |
|---|---|
| SOURCES | opus 3, fable 3, neon F4.2 |
| AGREEMENT | 3/3; opus and fable blind |
| Class | DEFECT (opus, fable; neon "High") |

| row | correct engine | effects run once, never again (opus `skipEffects`; fable: same, and "never runs") |
|---|---|---|
| cellx1000, cellx2500 (core baseline) | pass | PASS (gap) |
| dynamic/stable diamond mesh warm (stress) | pass | PASS (gap, opus) |
| control: diamond, manyEffectsFromOneSource | pass | FAILED (delivery probe) |

Claims broken: "Performance rows must keep a validation sink alive" and the gate "effect delivery"
(`SEMANTICS.md:371`, `:377-387`); "All active rows have value/delivery or lifecycle validation"
(`docs/benchmark-methodology.md:245-247`). Cause: `src/cellxBench.ts:104-107` (effect bodies only `read()`), validation
`:55-68` compares first and last layer values that a lazy pull reproduces without effects. Inherited from both
ancestors and the original cellx page (fable, web).

IMPACT: none on the published board: all 30 real adapters run every effect (fable count matrix; opus: the
patched validation passes all 30, except MobX and dalien cellx2500 stack overflows that also fail unpatched on
this host, Q8). It is a hole for the next adapter or release in two core rows. neon timed a no-op-effect cheat at
about 2x faster (PRELIMINARY). LITE-SIGNAL EFFECT: none.

Fix: `patches/d3-cellx-effect-validation.diff` (opus): each effect stores what it read; untimed validation that
every effect's last value equals its node's committed value. Proof: repro NOT REPRODUCED; all 30 adapters pass
the patched rows (MobX / dalien stack limit as above). Alternative: fable's `cellx-effects-observed.diff` (in fable's audit folder, not included)
(delivery count + last-layer values; also stops the callbacks returning a value, which changes cellx's own path,
fable L9) -- proven against the mock and upstream's tests, not against all 30 adapters; not included here.

### D4. The sample loop never yields, so five engines keep every earlier fixture alive

`node repro/d4-sync-loop-retains-fixtures.mjs` (fable)

| | |
|---|---|
| SOURCES | fable 4 (related, different mechanism: neon F7, see Q14 and contradiction C3) |
| AGREEMENT | 1/3 |
| Class | DEFECT |

| engine (`createComputations1to1`, live heap after forced full GC before each timed call) | growth per invocation | with one microtask checkpoint |
|---|---|---|
| alien-signals, Preact Signals (controls) | 0.0 MB | 0.0 MB |
| @amadeus-it-group/tansu | 108.6 MB | 0.0 MB |
| Svelte v5 | 79.9 MB | 0.0 MB |

Over all 30 adapters (fable's all-adapter heap log, not included; not re-run here): dalien +65.5 MB per invocation on this row; on `cellx1000`
@reatom/core +54.4, tansu +5.7, Svelte +2.8, dalien +1.5, $mol_wire +1.4 MB; 25 adapters flat. Published samples
show the consequence: tansu's and Svelte's creation rows slow down inside every process in 8 of 10 rows (last
third / first third 1.14-1.44); alien and Preact 0.98-1.03.

Claims broken: "Collect setup and previous-sample garbage outside the timed region" (`src/util/benchmark.ts:868`),
"earlier fixtures never keep live subscriptions into later samples" (`src/cellxBench.ts:79-80`). Cause:
`measureCase` (`src/util/benchmark.ts:822-956`) is synchronous from pilot to last sample; tansu releases from
`queueMicrotask`, Svelte 5 from its batch flush, dalien from a FinalizationRegistry task: none can run. An
interaction, but the harness states the invariant.

IMPACT: tansu (#18), Svelte v5 (#24), $mol_wire (#17), reatom (#29), dalien (unranked). Lower bound from
published samples (creation rows scored from the first third of each process): tansu 3.489 -> 3.422, Svelte
12.527 -> 12.215, no rank change. True size needs a measured run. LITE-SIGNAL EFFECT: none (flat heap; not
adjacent to an affected engine).

Fix: `patches/d4-sample-loop-yields.diff` (fable): `measureCase` becomes async and takes one `setImmediate` turn
after teardown, before the next setup. Proof: heap flat for tansu and Svelte, tsc clean, 1093 tests pass, repro
NOT REPRODUCED. Weakness: dalien's finalizers need a GC before the turn; not verified.

### D5. The Angular worker runs Angular's development mode

`node repro/d5-angular-dev-mode.mjs` (fable)

| | |
|---|---|
| SOURCES | fable 5 (neon F14.2 lists different Angular adapter details, Q19) |
| AGREEMENT | 1/3 |
| Class | DEFECT |

| | upstream build options | control: + `ngDevMode: "false"` |
|---|---|---|
| live `typeof ngDevMode==="undefined"\|\|ngDevMode` guards in `dist/workers/angular.cjs` | 70 | 0 |
| `globalThis.ngDevMode` after a real row | truthy object | undefined |
| own `toString` closure per `signal()` / `computed()` | yes | no |

Claim broken: "Adapters measure each library's reactive core, built as it ships to production" (`SEMANTICS.md:59`),
"production library builds" (`README.md:17`). Cause: `scripts/build.mjs:27` defines only `process.env.NODE_ENV`;
Angular reads `ngDevMode`, not `NODE_ENV`; the build's dev-twin check (`scripts/build.mjs:60-63`) cannot see it.
VERSION note: reproduced on @angular/core 22.2.5 (installed); the board used 22.2.6.

IMPACT: @angular/signals (#12, 2.446) on rows that create nodes in the timed region. Size: PRELIMINARY only (fable,
K=7 interleaved, load about 9.5): production / shipped ratio 0.41 on `createDataSignals`, 0.65 on
`createComputations1to1`, 0.995 on `updateComputations1to1`; projection 2.37 (stays #12) to 2.26 (#11).
LITE-SIGNAL EFFECT: none (Angular stays at least four places below).

Fix: `patches/d5-angular-production-mode.diff` (fable): one more define. Proof: rebuilt worker has 0 live guards,
repro NOT REPRODUCED. A sibling fork (transitive-bullshit) has an open PR on the same subject (#20, seen in its
listing only, read 2026-11-24).

### D6. A wrong result found during fixture setup is reported as a crash (`error`), not as `incorrect`

`node repro/d6-setup-failure-kind.mjs` (fable)

| | |
|---|---|
| SOURCES | fable 6 |
| AGREEMENT | 1/3 |
| Class | DEFECT |

A mock whose effects never run fails `diamond`, `manySourcesIntoOneDirectEffect` and `molBench` with kind `error`
("initial effects did not deliver correct values"); control: `dynamic/pure push` fails with kind `incorrect`.
Claim broken: `ValidationError` is "Thrown when a produced result is wrong, as opposed to a crash"
(`src/util/benchmark.ts:152`); `SEMANTICS.md:389-391` lists `incorrect` apart from throws / crashes. Cause:
`probe.verifyInitial` runs inside `setup()` and throws a plain `Error` (`src/util/delivery.ts:89-95`).
IMPACT: none on the published board (its failures are timeouts, out-of-memory and one stack overflow).
LITE-SIGNAL EFFECT: none. Fix: `patches/d6-delivery-failures-are-incorrect.diff` (fable): a `DeliveryError` recognised
by `failureOf`. Proof: all three rows report `incorrect` on the patched copy.

### D7. Adapter documentation: "29 library/version rows" while 30 run; the #1 engine is absent from every adapter table

`node repro/d7-adapter-docs.mjs` (opus)

| | |
|---|---|
| SOURCES | opus 5 (DEFECT); fable F10 (FACT, documentation drift); neon: none |
| AGREEMENT | 2/3 (opus and fable, both blind) |
| Class | DEFECT, low severity. fable called it a FACT because no board number changes; it is kept as a DEFECT because the docs state a wrong count (`README.md:269` "29 library/version rows", `docs/adapter-audit.md:4`, `docs/production.md:78`) and omit an active adapter from the matrix that claims to cover every adapter (`SEMANTICS.md:116-153`). |

catalog / config / published engines = 30 / 30 / 30; README, adapter-audit and production docs say 29;
reflex-quant (published #1, and one of the three calibration anchors whose round-1 probes set other engines'
censor ceilings, `src/util/benchmark.ts:620`) is absent from the README adapter table, the SEMANTICS matrix,
adapter-audit and adapter-recheck; control: every other active engine is in the README table. Further drift
(fable F10, opus): "14 adapters" (`docs/benchmark-methodology.md:202`), "24 libraries" (`:66`), "Seven adapters
expose native owner disposal" (`:239`) against 14 with `createScope`, "23 isolated rows" (`:271`), "wins require
disjoint median intervals" (`:47`, superseded by paired ratios); `README.md:197` points to `src/config.ts` for
graph parameters that live in `src/workloads.ts`; the stale comment `src/util/frameworkTypes.ts:17-19` (Q2).
IMPACT: no number changes. LITE-SIGNAL EFFECT: none. Fix (sketch): add the reflex-quant rows (lazy, native
batch, no owner scope, pull counts asserted); derive the counts from the catalog in a test.

---

## QUESTIONS (no written claim forbids it, but it changes what a row measures or treats engines unequally)

### Q1. molBench measures an identity cut-off plus `fib(16)`, not propagation (KNOWN-M)

`node repro/q1-molbench-cutoff.mjs` (opus; fable `repro-molbench-same-reference.mjs` agrees and extends)

| | |
|---|---|
| SOURCES | opus 1 (DEFECT), fable 7 (QUESTION); neon: not covered |
| AGREEMENT | 2/3, both blind in their Phase 2 (both then tagged SAME-AS KNOWN-M) |
| Class | QUESTION. opus argued DEFECT: `docs/benchmark-methodology.md:234-235` says the row "checks all three effect values at each commit", and the third check is vacuous (its expected value is the constant 3196), so a frozen F passes. Chosen QUESTION because the same paragraph documents the behaviour ("In-place mutation alone is not assumed to invalidate shallow signals", `:236-237`), the checks do run, and with this row's inputs a frozen F is not observably wrong; the issue is what the historical name measures. |

| engines (fable counts inside `fixture.run()`) | F evaluations | effect J runs | `hard()` = `fib(16)` calls | published estimate |
|---|---|---|---|---|
| 20 lazy engines with a cut-off (alien, reflex, reflex-quant, lite-signal, Preact, Vue, ...) | 0 | 0 | 3 | 20.5-43.9 us |
| Solid family, Oby, kairo | 0 | 0 | 4 | 28.5-37.5 us |
| tansu | 2 | 0 | 5 | 36.1 us |
| uSignal, rescript-signals | 2 | 2 | 7 | 47.2 us |
| s-js | 2 | 2 | 8 | 52.0 us |
| control: D returns a fresh array | F = 2 (all but $mol_wire) | | | |

opus adds: a frozen F passes validation on every engine; with D fresh but this row's writes, F re-runs but its
effect still does not (delta = a%2 - b%2 is 0 at every commit). Cause: `src/molBench.ts:37-43` (D mutates `items`
in place, returns the same reference), `:47` (F = hard(d[2].x || b) depends on D only), `:59-68` (equal
parities). Since d4c5ffc (2026-04-17); upstream's own first version (d1f154f) and both ancestors return a fresh
array. fable: published estimates line up with the number of `hard()` calls x 6.5-9 us, so the row mostly times
`fib(16)`.

IMPACT: 1 row of group `dynamic` (5.56% of the score); the three engines that pay F are the three slowest of 30.
Excluding the row changes 10 ranks. LITE-SIGNAL EFFECT: down, #8 -> #9 if excluded (rescript-signals loses its
2.30x row); with the patch, unknown without a measured run. lite-signal's own mirror of this row inherits the
flaw (found by lite-signal's own bench audit, its item M14; not included).

Fix: `patches/q1-molbench-cutoff.diff` (opus): D returns a fresh array AND the commits use mixed parities, so
delta, D[2].x and F change at every commit while G keeps switching. Proof: repro NOT REPRODUCED (F = 2 for every
engine; a frozen F now fails the warm-up delivery check); all 30 adapters pass the patched row. fable's one-line
`molbench-fresh-array.diff` (fable's audit folder, not included) restores F but not its effect (fable's own KNOWN-M
correction 2), so opus's is kept. Also shrink `hard()` (fable P10) or rename the row.

### Q2. The dependency-graph rows validate one number, the final sink pass (earlier note 2)

`node repro/q2-dynamic-rows-final-state-only.mjs` (fable, about 2 min; opus `repro-stress-sink-reads.mjs` agrees)

| | |
|---|---|
| SOURCES | opus 4 (DEFECT), fable 11 (QUESTION), neon F4.1 and F4.3; earlier note 2 |
| AGREEMENT | 3/3; opus and fable blind (neon had note 2) |
| Class | QUESTION. opus argued DEFECT on "Every produced result is validated" (`SEMANTICS.md:373`). Chosen QUESTION because the runner's own description is exact ("The mixed runner also performs one final sink pass for the returned checksum", `docs/benchmark-methodology.md:170`; "Dynamic graph rows check the observed sum", `SEMANTICS.md:371-372`). The stale comment `src/util/frameworkTypes.ts:17-19` ("verify the sum of all read effect elements in all iterations") is a documentation defect (D7 list). |

| fault (fable mock through the real rows; opus mock) | graph rows that still pass | control row (`updateComputations1to1`) |
|---|---|---|
| every top-level read returns the previous read's value | 15 of 15 | caught |
| stale on the first top-level read of a dirty sink (opus `lagSinkRead`) | 13 of 13 stress rows | -- |
| every 997th top-level read off by one | 13 of 15 | caught |
| every node evaluated twice, pull counts asserted | 8 of 15 (rows with `expected: {}`) | not caught (no target) |
| same, adapter without pull counts | 15 of 15 | -- |

10 adapters are never count-checked (@solidjs/signals, s-js, SolidJS, both Solid 2 RC, anod, cellx,
rescript-signals, MobX, kairo); MobX's published counts are exact on all 7 rows with a target (fable F15).
neon F4.3 (oracle precision, CONFIRMED for `deep`): the expected sum of `deep` is the literal
3.0239642676898464e241 (`src/workloads.ts:204`), whose ULP is about 5.9e225, so any error smaller than that in
the final sum is invisible; neon's oracle output, re-run here, puts 5 static rows above 2^53 (layered full-drain
cold 1.47e24, warm 4.15e24, burst flush 2.28e35 with a ULP of about 3.7e19, diamond mesh 1.42e34, deep 3.02e241),
while no dynamic node exceeds 2^53 and a +1 on source 0 is still detected.
Double evaluation passing is not a gap by itself: it only slows the faulty engine (C8).

IMPACT: stress suite (13 rows, unscored) and, in principle, 2 core rows that read only at the end. No real adapter
is known to return stale reads. LITE-SIGNAL EFFECT: none.
Fix (sketch, no patch): fold every in-loop sink read into a running checksum compared with a per-iteration
checksum from `src/util/referenceGraph.ts` (neon: use a modular int32 checksum, immune to the ULP problem); fill
the 8 missing count targets from the reference graph; turn the count check on for MobX.

### Q3. One scenario weighs from 1.67% to 16.67% of the score, by its name prefix

`node repro/q3-score-weights.mjs` (fable; opus `repro-pull-weight.mjs`, neon repro-01 agree)

| | |
|---|---|
| SOURCES | opus 7, fable 9, neon F1 |
| AGREEMENT | 3/3; opus and fable blind |
| Class | QUESTION (all agree; equal group weight is the documented rule, `README.md:245-246`) |

| scored group | rows | weight of one row |
|---|---|---|
| pull | 1 | 16.67% |
| push | 3 (2 of 5 excluded, Q4) | 5.56% |
| dynamic | 3 | 5.56% |
| update | 7 | 2.38% |
| baseline, creation | 10 each | 1.67% |

A flat geometric mean over the same 34 rows (a score the page also shows, `README.md:239`) changes 22 of 29 ranks
(s-js #22 -> #10, Svelte #24 -> #27); the top three do not change. Groups come from a name prefix
(`src/util/benchmark.ts:235-245`), and two of the six labels are wrong (D1, D2). LITE-SIGNAL EFFECT: down, #8 -> #9
under the flat mean. Fix (PROPOSAL, opus P1 = fable P1): a group needs at least 3 scored rows to get 1/G weight, or
publish both aggregations with a rank range.

### Q4. Censoring one engine removes a core scenario for everybody; the score is not monotone in time

`node repro/q4-censor-exclusion.mjs` (opus; fable `repro-censor-drops-scenarios.mjs` agrees)

| | |
|---|---|
| SOURCES | opus 8, fable 8, neon F1 (push lost its fan-out rows) and F6.3 |
| AGREEMENT | 3/3; opus and fable blind |
| Class | QUESTION (the rule is documented: `SEMANTICS.md:309-311`, `README.md:28`) |

Excluded on this board: `dynamic/pure push` (Svelte v5 censored on 3/3 machines, @reatom/core partial) and
`manyEffectsFromOneSource` (kairo, @reatom/core censored), the only two fan-out rows of group `push`, which is
described as "Fan-out propagation and effect delivery" (`README.md:189`). opus counterfactual: if those engines
had completed FASTER (1499 ms, below the 1500 ms floor), kairo's score gets WORSE (12.57x #25 -> 13.23x #27) and
11 ranks move; control: a 10% slowdown on a measured row worsens a score as expected. fable: keeping the two
scenarios (censored engine simply has no ratio there) changes 11 ranks; archived runs removed three different
scenario sets, so the `push` group held 3, 2 or 1 rows depending on the day.

IMPACT: all 29; 11 ranks. LITE-SIGNAL EFFECT: down, #8 -> #9 (swaps with rescript-signals). Fix (PROPOSAL, opus
P4 = fable P2): keep the scenario and score a censored row at its ceiling as a stated lower bound (PAR-style), or
give only the censored engine no ratio; exclude a scenario for everybody only on a correctness failure.

### Q5. Whether a slow row is censored depends on run order, the VM and its CPU model

`node repro/q5-censor-order-dependent.mjs` (fable)

| | |
|---|---|
| SOURCES | fable 10, neon F6.1, F6.2, F6.3; opus 8 notes ceilings of 1500 vs 2558 ms for one row |
| AGREEMENT | 2/3 (fable, neon; the same machine-2 example found by both) |
| Class | QUESTION. fable notes the code comment "Order-independent cap" (`src/util/benchmark.ts:637`) and `docs/benchmark-methodology.md:41` ("position dependence" fixed), but `SEMANTICS.md:284-285` allows a ceiling "more permissive than the eventual global best, never stricter", which is what the data show, so no claim is broken. |

| machine round 2, `dynamic/layered burst flush warm` | outcome | probe | ceiling |
|---|---|---|---|
| SolidJS 2 RC | measured | 2551.8 ms | 2557.9 ms |
| uSignal | censored (watchdog kill) | - | 2414.9 ms |
| @solidjs/signals 2 RC | censored | 2442.7 ms (completed) | 2320.0 ms |

Across VMs, 5 rows were measured on one VM with a probe above the ceiling that censored the same row on another
(lite-signal: measured at 2236.8 ms on round 2, censored at 1500 ms on round 3). neon, re-derived here: censor
rate on the 28 partial rows by CPU model: EPYC 9V45 0/16, EPYC 9V74 15/40, EPYC 7763 23/24, Xeon 6975P-C 4/4; and
(code reading, `src/util/benchmark.ts:631-657`) deferred rows are decided and re-run only after the whole round-1
order, i.e. after every later scenario (documented as "deferred until all available probes are known").
IMPACT: stress rows only on this board (0 core pairs); the same mechanism decides the excluded set of Q4.
LITE-SIGNAL EFFECT: none by rank (lite's own burst-flush row is one of the 28 partial rows). Fix (PROPOSAL, fable
P3, neon 2.6): decide a scenario's censoring after every participant's probe, or fix per-scenario ceilings in
the repository; scale the floor to a calibrated anchor rather than 1500 ms.

### Q6. Two warm-up invocations regardless of row length: short rows are sampled while still speeding up

`node repro/q6-warmup-drift.mjs` (fable; opus `repro-short-row-drift.mjs` agrees)

| | |
|---|---|
| SOURCES | opus 9, fable 12, neon F3 |
| AGREEMENT | 3/3; opus and fable blind |
| Class | QUESTION (warm-up policy documented, `README.md:26`, `SEMANTICS.md:219`; non-iid caveat `SEMANTICS.md:331-334`) |

| statistic (published chronological samples) | value | source |
|---|---|---|
| estimate / level of the last quarter: unstable, triangle, repeatedObservers, molBench | 1.10, 1.10, 1.09, 1.07 (control: 7 update rows 0.999-1.003) | fable |
| median of median(last third) / median(first third): pure pull, unstable, diamond, molBench | 0.660, 0.761, 0.771, 0.794 (control update rows 0.996-1.001) | opus |
| rounds (n >= 10) with samplesMs[0] > 1.5x the second-half median | steady 50.4% (re-derived 50.6%), all 38.8% | neon |
| rows hitting the 100-sample cap before 250 ms of measured work | 18 rows; molBench 2.4-11.2 ms per process, repeatedObservers, dispose-retained, triangle, ... | neon, re-derived (`checks/`) |

neon's "Critical" framing rests on `samplesMs[0]`; the board's estimator is the median, which is robust to one
sample, so opus's and fable's median-level drift (7-35%, engine-dependent) is the size that reaches the board.
neon's point that for steady rows `samplesMs[0]` is also the censor probe is correct (`README.md:24`,
`SEMANTICS.md:275`). IMPACT: estimator "median of each process's last half" changes 7 ranks (@vue/reactivity 3.6
RC #6 -> #4, @reactively #4 -> #6, rescript-signals #9 -> #7, anod #7 -> #8). LITE-SIGNAL EFFECT: down, #8 -> #9.
Fix (PROPOSAL, opus P5, fable P4, neon 2.4): warm up for a minimum time or until a drift test passes, or time
batches of k invocations so a sample is >= 1 ms; report a per-row drift sentinel.

### Q7. Ranks #4 to #9 are not separated by the data; the page marks only some near-ties

`node repro/q7-rank-sensitivity.mjs` (opus)

| | |
|---|---|
| SOURCES | opus 10, neon F12.5, fable F5 (FACT) and P9 |
| AGREEMENT | 3/3 (opus, fable blind) |
| Class | QUESTION (the `~` mark is implemented as documented, `README.md:236`, `SEMANTICS.md:363-364`) |

| engine | published | span over 6 scorings (median, per-process mean, min, 2nd-half median, pooled machines, mean of rounds) |
|---|---|---|
| @reactively | 4 | 4-6 |
| Preact Signals | 5 ~ | 5-6 |
| @vue/reactivity 3.6 RC | 6 ~ | 4-6 |
| anod | 7 | 7-9 |
| lite-signal | 8 | 8-9 |
| rescript-signals | 9 | 7-9 |
| control: ranks 1-3 and 10-13 | | fixed |

fable F5: the two archived same-day runs (eac8a51, 9223ec7) differ in 2 of 29 ranks and by 0.983-1.027 in score;
gaps of 0.01% (#4/#5), 0.3% (#8/#9) and 0.003% (#14/#15) are far inside that. neon F12.5: no tie mark on the 0.3%
lite/rescript gap; uSignal (#14) ranks above reactive-engine (#15), which won 2 of 3 machine rounds and tied the
third. LITE-SIGNAL EFFECT: 8 or 9 depending on the choice; never above 8. Fix (PROPOSAL, opus P2, fable P9, neon
2.10): rank intervals (bootstrap over scenarios within groups x machine rounds) and tiers; replication bands.

### Q8. dalien-signals is unranked by the host's default stack size

`node repro/q8-stack-depth.mjs` (opus)

| | |
|---|---|
| SOURCES | opus 11 |
| AGREEMENT | 1/3 |
| Class | QUESTION (stack overflow is a listed failure kind, `SEMANTICS.md:391-392`) |

cellx2500 through the real runner and worker: dalien-signals (published linux/x64: FAILED stack-overflow, its only
failed core row) overflows at the default stack and passes with `--stack-size=3000`; MobX overflows locally on
darwin/arm64 (node 26.8.2 and 24.15.0) but was measured on the published linux/x64 run (VERSION-SENSITIVE, 7.1.5
local vs 7.1.7 published); control alien-signals passes. Workers get a fixed heap (`src/util/benchmark.ts:258-263`)
but the host's default stack. IMPACT: treating dalien's row as censored ranks dalien #8. LITE-SIGNAL EFFECT: down,
#8 -> #9. Fix (PROPOSAL, opus P6): a fixed `--stack-size` in worker execArgv, recorded next to heap_mb.

### Q9. The TC39 adapter scans the Watcher three times per commit

`node repro/q9-tc39-drain.mjs` (opus)

| | |
|---|---|
| SOURCES | opus 12, neon F14.1; fable L10 (lead, not scripted) |
| AGREEMENT | 2/3 reproduced (opus, neon), plus fable's code-reading lead |
| Class | QUESTION. neon called it an adapter bug; `docs/adapter-recheck.md:47-53` says only that the README leaves scheduling to consumers, so no written claim is broken. |

96 effects on one signal, per commit: adapter `getPending()` 3 calls, 288 producers scanned, 96 effect runs;
control (single drain): 1 call, 96 scanned, 96 runs (`src/frameworks/tc39-proposal-signals-stage-0.ts:18-30`).
neon: 300 calls for 100 batched writes (neon's count, not re-run; consistent with 3 per commit). Cost per scan: VERSION-SENSITIVE (signal-polyfill 0.2.2 local, 0.2.3
published); the call count is adapter-side. IMPACT: TC39 (#20) only; size unknown without timing. LITE-SIGNAL
EFFECT: none. Fix: `patches/q9-tc39-drain.diff` (opus): one scan per pass, re-drain only on re-notify. Proof: repro
NOT REPRODUCED, upstream's 33 TC39-filtered tests pass. Residual risk: an effect that writes before `watch()`
re-arms may not re-notify.

### Q10. `layered full-drain cold` times 16,384 first evaluations for lazy engines and none for eager ones (earlier note 3)

`node repro/q10-layered-cold-setup-work.mjs` (fable; opus `repro-layered-cold-split.mjs` reads the published counters)

| | |
|---|---|
| SOURCES | earlier note 3; opus (Phase 3 addition), fable 13, neon F9 |
| AGREEMENT | 3/3 reproduced; none independent (all from the note) |
| Class | QUESTION (all agree; `measureBuild: false`, `src/workloads.ts:49-62`; no claim that timed work is equal) |

Counted inside the timed call: lazy engines (alien, lite-signal, Preact) 249,624 computed evaluations of which
16,384 first evaluations; eager-at-creation engines (s-js, SolidJS, anod) 233,240; control (warm row) 235,200 for
all. Published counters: 249,624 for 19 frameworks, 233,240 for 7, 1,966,080 for cellx. IMPACT: one stress row
(unscored); 6.6-7% more evaluations on the clock for 19 lazy engines. LITE-SIGNAL EFFECT: none by rank (stress);
lite is in the group that pays the extra evaluations, so a fix moves lite up or not at all. Fix (sketch): read
every sink once in setup for all engines (and name the row accordingly), or build on the clock for all.

### Q11. Adapter bridges: reflex-quant's and $mol_wire's adapters allocate no per-node closures; 12+ others do

| | |
|---|---|
| SOURCES | neon F2; fable L1 (lead) |
| AGREEMENT | 2/3 for the code fact; the size is neon-only and PRELIMINARY |
| Class | QUESTION (adapter fairness) |
| Status | code CONFIRMED here; magnitude PRELIMINARY |

Code (re-read for this merge): `src/frameworks/reflexQuant.ts:21-50` returns `{ source, read: readSignal, write:
writeSignal }` with shared module-level functions (one object per node, no closure); `src/frameworks/molWire.ts:8-16`
returns the native node subclass; `src/frameworks/preactSignals.ts:6-18` (and per neon, not each re-read here: Vue, Svelte, uSignal,
reactive-engine, Signia, reactively, cellx, rescript, MobX, TC39, kairo) allocate a wrapper plus one or two
closures per node. `docs/adapter-audit.md:65-69` itself says a property-API bridge "can use shared prototype
methods too and is not inherently a closure requirement". reflex-quant is the benchmark author's own library; the
technical difference is the bridge shape only. Measured effect: neon's interleaved local A/B (3 rounds, busy host,
PRELIMINARY) rewrote Preact, Vue 3.6 RC and Svelte with the same shared-method bridge: `createDataSignals` -61%,
-59%, -74%; `createComputations1to1` -7%, -8%, -20%. Not re-measured here (no timed runs). IMPACT: creation rows
(1/6 of the score) for property-API engines; rank effect unknown. LITE-SIGNAL EFFECT: unknown (lite's adapter is
not in neon's list; it was not rewritten). Fix (PROPOSAL, neon 2.1): one shared-prototype bridge helper for every
property / handle API, then a measured A/B with an A/A twin before any claim.

### Q12. Unobserved pull graphs: MobX gets `keepAlive`; kairo, cellx and Svelte recompute far more without an observer

| | |
|---|---|
| SOURCES | neon F8; fable L13 (kairo never caches an unobserved computed), L14 (MobX keepAlive disclosed) |
| AGREEMENT | 2/3 (neon finding, fable leads) |
| Class | QUESTION |
| Status | counts CONFIRMED from published counters and code; Svelte ratio PRELIMINARY |

All 13 `large_graph` rows and pure pull have no observer on the leaves. `src/frameworks/mobx.ts:17-19` uses
`computed(fn, { keepAlive: true })`, with the reason in the comment (exponential traversal without observers,
MobX #3926), so it is disclosed. Published counters: kairo 174,752 recomputations on pure pull (lazy peers 224);
cellx 1,572,864 on `stable diamond mesh warm` (others 24,576) and 1,966,080 on `layered full-drain warm` (others
235,200). neon PRELIMINARY: Svelte v5 `dynamic component` 2,236 ms unobserved vs 18.7 ms with one effect on the
leaves; kairo exactly 2^d evaluations on an unobserved binary diamond (neon probe, not re-run: UNVERIFIED). IMPACT: stress
coverage of Svelte, kairo (0 of 13 completed) and cellx. LITE-SIGNAL EFFECT: none. Fix (PROPOSAL, neon 2.3):
separate observed graph rows from detached-pull rows, and apply one rule (observer or keep-alive) to every engine.

### Q13. `stable diamond mesh warm` is 64 disconnected components with 50% duplicate edges

| | |
|---|---|
| SOURCES | neon F5; opus L6 (lead: "fanIn 8 reads 4 distinct nodes twice each") |
| AGREEMENT | 2/3 |
| Class | QUESTION (no doc describes the mesh topology beyond the row name and `graphKind: "diamond-mesh"`) |
| Status | CONFIRMED by code reading and published counters |

`pickMeshSources` (`src/util/dependencyGraph.ts:368-387`): `sharedOffset = floor(sourceDex / 2)` gives offsets
0,0,1,1,2,2,3,3, so every node reads 4 distinct parents twice; `clusterBase` is always a multiple of 4, so a cluster
of 4 nodes reads one cluster of the previous layer. neon counted 65,536 of 131,072 edges duplicate, 64 components,
256 of 16,384 nodes (1.56%) reachable from source 0; published counters: 24,576 nodes recomputed and 196,608
edges traversed per invocation for 26 engines. Stress only. LITE-SIGNAL EFFECT: none. Fix (sketch): distinct
offsets and a cross-cluster shift, re-baselined.

### Q14. `steady` GC: setup garbage of fresh-fixture rows is collected inside timed samples

| | |
|---|---|
| SOURCES | neon F7; fable F4 (FACT: documented); earlier note 4 (changed upstream) |
| AGREEMENT | 1/3 as a question (fable read the same behaviour as a documented FACT) |
| Class | QUESTION. The behaviour is documented (`README.md:24`: "one GC after the first fixture setup, then natural GC during warmup and sampling"); only the code comment `src/util/benchmark.ts:868` ("Collect setup and previous-sample garbage outside the timed region") over-states it. |
| Status | published spike counts CONFIRMED (re-run); attribution to setup garbage and the GC timings UNVERIFIED / PRELIMINARY |

Published samples (neon repro-02c, re-run): rounds with max >= 5x median: steady + fresh fixture 9.6% (895 of
9,369, 38 scenarios), steady + warm-reused 0.0% (0 of 684, 3 scenarios), cold 0.4%. Largest: reactive-engine
molBench 129x at sample 49. neon's PerformanceObserver probe (one minor GC in a lite-signal cellx2500 sample under
steady, none under cold; cold slows alien / reflex-quant / Preact 13-23%) is PRELIMINARY. IMPACT: noise on short
fresh-fixture rows, engine-dependent; size on the board unknown. LITE-SIGNAL EFFECT: unknown. Fix (PROPOSAL, neon
2.5): `reuseFixture` with an exact checkpoint reset for steady rows, not per-sample full GC; fix the comment.

### Q15. On `steady` rows, pilot and warm-up are unsupervised: a slow but valid row becomes FAILED(timeout), not censored

| | |
|---|---|
| SOURCES | neon F6.4; opus L7 (lead: a core TIMEOUT unranks like a wrong result) |
| AGREEMENT | 2/3 (neon reproduced with a synthetic worker; opus lead) |
| Class | QUESTION: documented (`README.md:24`, `SEMANTICS.md:276-277`: cold call and warm-up are protected only by the row watchdog), in tension with "performance censoring does not disqualify a library" (`README.md:28`) |
| Status | mechanism CONFIRMED by code reading; neon's run (80 ms worker, 200 ms row timeout: steady -> FAILED(timeout), cold -> CENSORED) not re-run: UNVERIFIED |

IMPACT: none on this board (no core timeout; the published timeouts are stress rows of kairo and Svelte).
LITE-SIGNAL EFFECT: none. Fix (PROPOSAL, neon 2.6): a soft bound on pilot + warm-up that censors instead of failing.

### Q16. Scorer and statistics details (neon-only)

| | |
|---|---|
| SOURCES | neon F12.1-F12.4 |
| AGREEMENT | 1/3 (F12.1 contradicts opus FACT 16; resolved C7) |
| Class | QUESTION |
| Status | all four CONFIRMED by re-running neon's published-data script; F12.1 also by an independent check (`checks/check-neon-published.mjs`) |

- F12.1 Unranked dalien-signals sets the per-round best of `broadPropagation` (round 1). Excluding unranked
  engines from the best swaps #4 @reactively and #5 Preact Signals (1.6268 vs 1.6259; a 0.06% gap).
- F12.2 0 of 28 partial rows carry paired statistics (`scripts/merge-shards.mjs:198` drops any row with a capped
  machine).
- F12.3 `sd_within` divides an order-statistic interval by 2 x 1.96 (`scripts/merge-shards.mjs:500`), but the
  interval's exact coverage is 96.5-98.8% for the common sample counts, so `sd_within` is overstated by about
  7.5% (n = 100) to 28.6% (n = 11). `sd_within` is descriptive (`SEMANTICS.md:256-258`).
- F12.4 Median `sd_machine` by shard: 2.0% (3x EPYC 7763) to 33.9% (mixed CPUs).
LITE-SIGNAL EFFECT: none (F12.1 does not involve rank 8). Fix: best over ranked engines only (or document it);
pair partial rows on their measured machines; exact quantile for `sd_within`.

### Q17. Environment parsing fails open

| | |
|---|---|
| SOURCES | neon F13 |
| AGREEMENT | 1/3 |
| Class | QUESTION (no claim; reproducibility hygiene) |
| Status | CONFIRMED by code reading; neon's run (typos, exit 0) not re-run: UNVERIFIED (it starts the benchmark) |

`src/index.ts:14-29` throws only when NO framework name matches, so a misspelled name in a list is dropped
silently; `BENCH_FILTER` parts that match nothing are ignored (`src/util/benchmark.ts:271-278`);
`readPositiveNumber` returns the default for `"500ms"` or `-5` (`:1192-1195`), while `readPositiveInteger` throws
(`:1197-1204`). IMPACT: none on the board. LITE-SIGNAL EFFECT: none. Fix (PROPOSAL, neon 2.9): fail closed on unknown,
empty, duplicate or malformed values.

### Q18. Work counters are not in the samples JSON and the merge never compares them

| | |
|---|---|
| SOURCES | neon F11; opus P7 and fable P6 propose the same remedy |
| AGREEMENT | 1/3 as a finding |
| Class | QUESTION |
| Status | CONFIRMED: `latest.samples.json` contains 0 `nodesRecomputed` keys; `scripts/merge-shards.mjs` has no counter handling; the log prints one machine's counters. neon's synthetic merge (1,000 vs 999,999 merged silently) not re-run: UNVERIFIED. Host-load provenance: absent (opus P7). |

IMPACT: third parties cannot check equal work from the JSON (fable's count matrix needed 1,140 child processes).
LITE-SIGNAL EFFECT: none. Fix (PROPOSAL): persist counters per round and machine; fail the merge on disagreement.

### Q19. Adapter details (bundle)

| item | sources | status | note |
|---|---|---|---|
| kairo writes `set(() => value)`: one closure per write and the updater branch (`src/frameworks/kairo.ts:24`) | neon F14.3, opus L2 | CONFIRMED (code) | neon: native setter accepts values; -6% on update1to1 PRELIMINARY |
| cellx adapter calls `release()` after `batch(fn)`, which already releases (`src/frameworks/cellx.ts:34-38`; `node_modules/cellx/dist/cellx.js:635-639`) | neon F14.4 | CONFIRMED (code) | cost unknown |
| Solid 2 / @solidjs/signals: every untracked read calls `getObserver()` and may `flush()` (`src/frameworks/solid-signals.ts:156-172`, `solid2Factory.ts`) | neon F14.5, fable L3 | CONFIRMED (code); documented in `docs/adapter-audit.md:71-72` | neon -15.7% on update1to1000 PRELIMINARY |
| Solid 2 RC adapters call `fn(); flush()` instead of `flush(fn)`: one queued microtask per commit (9,999 per pure-pull call) | fable L2 | count reproduced (fable, D4 probe); time unknown | |
| Angular: standalone writes stay queued until the next batch; a throwing effect strands the rest of the queue; one bound function per effect (`src/frameworks/angularSignals.ts:32-61`) | neon F14.2 | CONFIRMED (code) | no current row writes unbatched to an Angular effect or throws in one, so no board effect shown |

Class: QUESTION (adapter fidelity, `SEMANTICS.md:31-34` "closest production semantics"); none is shown to move a
rank. LITE-SIGNAL EFFECT: none.

### Q20. `bench-results/semantic-gauntlet.json` is stale

| | |
|---|---|
| SOURCES | neon F15 |
| AGREEMENT | 1/3 |
| Class | QUESTION (a separate artifact; not on the board) |
| Status | CONFIRMED (re-run): recorded on node v25.2.0 (not the `.nvmrc` 24.15.0), reflex-quant 1.1.1 / mobx 7.1.5 / solid-js 1.9.18 vs 1.2.0 / 7.1.7 / 1.9.19 in package.json; 7 of 30 libraries; inline adapters in `scripts/semantic-gauntlet/compare.mjs` differ from `src/frameworks/*` (neon; not re-checked: UNVERIFIED) |

LITE-SIGNAL EFFECT: none. Fix: regenerate it in CI with the pinned node and the shared adapters.

---

## FACTS (checked; allowed by the claims, or harmless)

| # | fact | sources | evidence |
|---|---|---|---|
| X1 | The published scores and ranks are exactly reproducible from `latest.samples.json` by independent code (29 ranked; max difference 9.7e-5) | opus 14, fable F1; neon's re-scoring agrees | `repro/x1-score-recompute.mjs` -> NOT REPRODUCED (0 mismatches; control: lite x1.2 -> rank 11) |
| X2 | The merge refuses mismatched commit / lockfile / bundle / node / packages; machine rounds keep scenario partitions identical | opus 13 | `scripts/merge-shards.mjs:59-134` |
| X3 | No measurable position effect in the execution order; anchors running first gain nothing measurable (+0.19% +- 0.33% first position; round 1 is +0.76% for everybody) | opus 15, fable F2, F3 | published samples with upstream's `executionOrder` (see C1) |
| X4 | Anchor hoisting is structural and documented: in round 1 only, alien-signals, reflex-quant and reflex run first (`src/util/benchmark.ts:617-629`; `README.md:24`, `SEMANTICS.md:260-264`), so their 3-round mean slot is earlier (neon: 10.44 vs 14.95) | neon F10 | code CONFIRMED; neon's slot numbers not re-derived: UNVERIFIED |
| X5 | Normalising by the best of all rows including unranked engines is a per-round constant: it cannot reorder engines within a machine round, but it can across the median of rounds (one 0.06% swap on this board) | opus 16 (amended), neon F12.1 | C7 |
| X6 | Faults that only make the faulty engine slower pass validation (double evaluation, no batching, no-op dispose): a slower-but-right engine is not incorrect | opus 17, fable F9; neon F4 listed double evaluation as a gap (C8) | mock matrices |
| X7 | avoidablePropagation's outputs are constant by design; the row rewards cut-off on purpose | opus 18 | `src/kairo/observed.ts:73-74, 178-188` |
| X8 | Within a row every invocation does identical work (all 51 rows); on 30 of 38 counted rows all 30 adapters do the same work, and the differences are engine semantics (cut-off, eager evaluation) | opus 19, fable F8 | count matrices |
| X9 | lite-signal's adapter is not tuned in its favour: native calls, `prealloc: "lazy"` keeps pool growth in the timed creation rows, reason written in the adapter | opus 20, fable F13 | `src/frameworks/liteSignal.ts:5-14` |
| X10 | Between-machine noise dominates (median sd_machine 0.253 vs sd_process 0.028 vs sd_within 0.015, ln time); ratios taken inside one VM are what make the board usable | opus 21, neon F12.4 | `merged.noise` |
| X11 | Worker bundles are byte-identical across checkout paths (31 files); `dist/index.js` 47017675 again in the merge's checkout and in this folder's | fable F6; this merge | rebuilt |
| X12 | Upstream's own tests pass offline (21 files, 1093 passed, 1 expected fail, 12 skipped; vitest 5.0.5 installed) | fable F7 | fable's patch-verification copy (not included) |
| X13 | A merged censored row shows the first censored machine's ceiling when machines differ (cosmetic remnant of earlier note 1) | fable F11 | `scripts/merge-shards.mjs:249-250` |
| X14 | The kairo rows' `workChecksum` is computed and never validated; the delivery probe covers the same ground | fable F12 | `src/kairo/observed.ts:222-226` |
| X15 | reactive-engine moved #28 -> #15 between the last two archived runs with its 3.0.0 release | fable F14 | archived runs |
| X16 | MobX is exempt from the count check although its published counts are exact on all 7 rows with a target | fable F15 | `src/frameworkCatalog.json:170-175` |
| X17 | The published page lists the excluded scenarios by name and says censored rows are not a median or a lower bound | fable F16 | deployed page, read 2026-11-24 |
| X18 | Earlier note 1 (capped label follows machine 1) is fixed at 12f169b: 28 mixed-capping rows, 0 label mismatches, 0 `SLOW/CAPPED` tokens | opus, fable, neon | `repro/x2-capped-label.mjs` -> NOT REPRODUCED |
| X19 | Earlier note 4's mechanism (forced GC before every sample) now applies only to `cold` (creation) rows, by declared design | opus, fable, neon | `repro/x3-gc-before-sample.mjs` -> NOT REPRODUCED; `src/util/benchmark.ts:869` |

---

## Contradictions and differences between the audits

| # | topic | what each says | resolution |
|---|---|---|---|
| C1 | anchor hoisting | neon F10: hoisting the 3 anchors in round 1 only "breaks reverse-order drift cancellation" (mean slot 10.44 vs 14.95; slot numbers UNVERIFIED). opus FACT 15, fable F2/F3: no position-in-order effect in the published data; anchors gain nothing measurable | Both stand, on different questions. The hoist is structural and documented (`README.md:24`, `SEMANTICS.md:260-264`; code `src/util/benchmark.ts:617-629`, read here); its measured effect on the published samples is nil within +-0.33%. Classified FACT (X3, X4); no upstream action needed beyond a note. |
| C2 | earlier note 4 status | opus: REFUTED for the named rows (they are `steady` now). fable: CHANGED UPSTREAM at 2f79755, partly reproduced (short rows still see 0 GCs per call, because they allocate little); board effect unreproduced. neon: CHANGED, and a NEW defect (F7, setup garbage collected inside samples) | All three read the same code: at 12f169b the per-invocation forced GC exists only in `cold` mode (`src/util/benchmark.ts:869`). Verdict: note 4 as written is no longer true (CHANGED UPSTREAM; X19). The two follow-ups are different statements, both kept: fable's 0-GC counts (FACT) and neon's spike counts (Q14, QUESTION, attribution unverified). |
| C3 | GC / garbage across samples | neon F7: collectable setup garbage is collected inside timed windows on fresh-fixture steady rows (and lite's reset allocates about 2.2 MB per cellx1000 setup). fable 4: on 5 engines the previous fixtures are NOT collectable at all (still reachable: the loop never yields). fable F4: steady-mode setup garbage in samples is documented. opus FACT 20: lite's adapter keeps pool allocation in timed creation rows, a negligible tilt in its favour at most | Compatible: different mechanisms on different engines. fable 4 is deterministic (heap counts, proven patch) -> D4 DEFECT. neon F7 is documented behaviour -> Q14 QUESTION; its published spike buckets are re-derived, its attribution and GC timings are not. opus 20 and neon's lite numbers concern lite's adapter only (X9; neon's 2.2 MB UNVERIFIED). |
| C4 | molBench class | opus 1 DEFECT (vacuous third check, `methodology.md:234-235`); fable 7 QUESTION (same-reference documented, `:236-237`) | QUESTION (Q1), reason in Q1. Both agree on the mechanism and the fix direction; opus's patch is the complete one. |
| C5 | graph-row validation class | opus 4 DEFECT (`SEMANTICS.md:373`); fable 11 QUESTION (`methodology.md:170`) | QUESTION (Q2); the stale comment `frameworkTypes.ts:17-19` goes to D7. |
| C6 | adapter docs class | opus 5 DEFECT; fable F10 FACT | DEFECT, low (D7): the docs state a wrong count and omit the #1 engine from the adapter matrix. |
| C7 | best-of-all-rows normalisation | opus FACT 16: including unranked engines in the per-test best cannot change ranks (algebra). neon F12.1: excluding unranked dalien-signals swaps #4 / #5 | Resolved by computation (`checks/check-neon-published.mjs`, and neon's own script re-run): neon is right. The best is a per-round constant, so it cannot reorder engines inside one machine round, but the score is the MEDIAN of three per-round scores, and engines whose medians come from different rounds can swap. Effect here: @reactively / Preact Signals, 0.06%. X5 amended. |
| C8 | double evaluation passing | neon F4 lists "double-evaluating mock passes 8/13 (13/13 without counts)" as a gap; opus 17 and fable F9: harmless, it only slows the faulty engine | FACT (X6). The real gap all three found is a STALE result passing (Q2). |
| C9 | pure pull fix | opus: warm the row (construction off the clock, one dirty pull); fable: read sinks after every commit (a real dirty-read row) | Not a contradiction: two valid fixes for two broken claims of D1 (C1 vs C11). Both patches are kept; the choice of meaning is upstream's. |
| C10 | warm-up size | neon F3 "Critical" on `samplesMs[0]` (50.4% of steady rounds > 1.5x); opus / fable "modest", 7-35% median drift on a few rows | Different statistics, both re-derived. The median estimator is robust to the first sample, so the board-level size is opus's / fable's (7 rank changes under a last-half estimator). Kept as one QUESTION (Q6). |
| C11 | SolidJS 2 RC not censored although slower than a censored peer | neon F6.1 presents it as a defect; fable 10 shows it is what `SEMANTICS.md:284-285` allows | QUESTION (Q5); stress rows only. |
| C12 | Solid untracked-read flush, MobX keepAlive, TC39 drain | neon: adapter bugs; fable / upstream docs: disclosed adapter choices | Solid flush and MobX keepAlive are documented (`docs/adapter-audit.md:71-72`, `mobx.ts:17-18`); TC39's triple scan is not covered by a claim. All QUESTION (Q9, Q12, Q19). |

---

## Earlier notes (2026-11-10, fb10dd9) and KNOWN-M, re-checked at 12f169b

The earlier notes are four items the lite-signal maintainer wrote on 2026-11-10 against fb10dd9 (not included);
KNOWN-M is the molBench statement the auditors were given in their brief.

| item | neon | opus | fable | merged verdict |
|---|---|---|---|---|
| Note 1: capped label follows the first machine only | FIXED (9223ec7): 0 `SLOW/CAPPED` lines; 28 partial and 32 censored rows match | REFUTED at 12f169b: 28 mixed rows, 0 mismatches | ALREADY-FIXED-UPSTREAM 9223ec7; remnant: a fully censored row shows the first machine's ceiling | FIXED UPSTREAM (X18; remnant X13). Re-run here: `x2-capped-label` NOT REPRODUCED |
| Note 2: dynamic rows have weak result checks | STILL PRESENT -> F4 | REPRODUCED (SAME-AS opus 4, found blind) | REPRODUCED and extended (fable 11, found blind) | REPRODUCED -> Q2 |
| Note 3: layered cold row charges lazy and eager engines differently | STILL PRESENT -> F9 | REPRODUCED in Phase 3 | REPRODUCED in Phase 3 (fable 13) | REPRODUCED -> Q10 (same numbers: 249,624 vs 233,240, 7 eager engines) |
| Note 4: a full GC before each sample can hide GC cost on short rows | CHANGED (2f79755) -> new defect F7 | REFUTED for the named rows (steady at 12f169b) | CHANGED UPSTREAM 2f79755; 0 GCs on short rows persists (low allocation); board effect UNREPRODUCED | CHANGED UPSTREAM; note 4 as written no longer holds (X19). Follow-ups: Q14 (neon), fable's 0-GC counts (FACT). See C2 |
| KNOWN-M: molBench measures an equality cut-off since d4c5ffc | not covered | REPRODUCED (opus 1, blind) | REPRODUCED with three corrections: 4 engines DO re-run F; a fresh array alone re-runs F but not its effect; the row mostly times `fib(16)` (fable 7, blind) | REPRODUCED -> Q1, with fable's corrections |

---

## IMPROVEMENTS (merged and ranked by impact on how far the board can be trusted)

Per-finding fixes are in each finding. Evidence status: PROVEN here (a repro or computation in an audit
folder shows the problem or the effect), PROVEN in lite's bench (a method with a gate in lite-signal's bench at
dfce8da), UNPROVEN. "lite-derived" marks a proposal that comes from lite-signal's own bench; its weakness line
names what lite-signal's own bench audits (internal notes, not included; their item ids are M* and B*)
found wrong with that method in lite.

| rank | improvement | fixes | sources | cost | evidence | weaknesses |
|---|---|---|---|---|---|---|
| 1 | Make the `pull` group measure dirty reads (D1 patch) and give no single row 1/6 of the score: a group needs >= 3 scored rows, or publish flat and balanced ranks side by side | D1, Q3 | opus P1, fable P1, neon 2.3 | one config line + scorer change; re-baseline | PROVEN here (23 ranks move with one row; 22 under flat mean) | every grouping is an opinion; the flat mean gives 59% of the weight to creation + baseline rows |
| 2 | Keep censored scenarios: score a censored row at its ceiling (stated lower bound) or drop only that engine's ratio; decide censoring after every participant's probe | Q4, Q5 | opus P4, fable P2, P3, neon 2.6 | small (scorer), medium (runner) | PROVEN here as counterfactuals (11 ranks) | a ceiling flatters the censored engine; deferral for all costs CI time |
| 3 | Publish rank intervals / tiers (bootstrap over scenarios within groups x machine rounds) and replication bands; tie marks for any overlapping pair | Q7, Q16 | opus P2, fable P9, neon 2.10 | re-scoring only (seconds) | PROVEN here (spans 4-9; same-day runs differ by 2.7%) | bootstrap over 34 scenarios x 3 machines is coarse; harder to read than one rank |
| 4 | molBench: propagate through F with mixed parities (Q1 patch) or rename; shrink `hard()` / require a minimum of timed reactive work per invocation | Q1, Q6 | opus 1, fable 7, P10, neon 2.4 | 6 lines; re-baseline | PROVEN here (patch, 30 adapters pass) | breaks comparability with older boards. lite-derived part (loop-size floor): lite's floor guards loop size only and does not detect a loop that stops working (B3) |
| 5 | Close the validation holes and keep them closed: cellx effects (D3 patch), per-iteration graph checksum (modular int32), failure kind (D6 patch), and a must-fail mock-engine suite in CI that every row claiming a gate must fail | D3, D6, Q2 | opus P3, fable P5, P7, neon 2.2 | ~200 lines (opus `lib/mockEngine.ts`, fable `lib/mock-harness.mjs` are working starts) + ~1 min CI | PROVEN here (fault matrices, patches) | a mock tests the oracle, not the real adapters. lite-derived (sink oracle, guard self-test): lite's dead-sink guard could not fire on 2 of 6 scenarios and its self-test still missed inert guards (B3, M3); run the suite through the same path that produces the board |
| 6 | Build and run hygiene: `ngDevMode: false` plus a build check that fails on live dev guards; one event-loop turn between invocations | D4, D5 | fable P8, fable 4 | small | PROVEN here (patches) | per-library guard knowledge; a text check can be fooled |
| 7 | Warm-up by time or stability, or batched invocations for sub-ms rows; a per-row drift sentinel (last third / first third) | Q6 | opus P5, fable P4, neon 2.4 | +50-250 ms per short row | problem PROVEN here; remedy UNPROVEN (needs a timed A/B) | steady state may never be reached (Barrett et al. 2017); batching changes what a sample is. lite-derived sentinel: lite's DRIFT_TOL "5%" parsed to NaN and silently disabled it; not in all runners (M16, B6) |
| 8 | Publish a work profile per row and engine (counters in the samples JSON) and fail the merge when machines disagree | Q18, X8 | fable P6, neon 2.7, opus O5 | medium | PROVEN here (fable count matrix, 30 x 38) | unequal work is sometimes the point (cut-offs): a flag, not a failure. lite-derived (cross-engine equal-work check): inert in lite whenever one engine ran per process, i.e. every published lite protocol (B4, M7) |
| 9 | Fixed worker `--stack-size`, recorded next to heap_mb | Q8 | opus P6 | one execArgv flag | PROVEN here | a larger stack hides real recursion limits |
| 10 | Provenance per shard: host load / steal, CPU model next to each comparison | Q5, Q16 | opus P7, neon 2.8 | small | UNPROVEN as a mechanism | load1 is a 1-minute average. lite-derived: lite's own stamp records no load or busy process (B10, M16) |
| 11 | Fail-closed env parsing | Q17 | neon 2.9 | small | code CONFIRMED | lite-derived (`lib/guards.mjs`): lite's per-engine stamp checks accepted mixed hosts and empty stamps (B6, B10) |
| 12 | One shared-prototype bridge for every property / handle adapter, then a measured A/B (A/A twin, must-fail control) | Q11 | neon 2.1 | moderate | PRELIMINARY (neon timing) | adapter rewrites change each library's numbers; must be measured per adapter |
| 13 | Separate observed graph rows from detached-pull rows; one keep-alive / observer rule for all | Q12 | neon 2.3 | moderate | counts CONFIRMED; timing PRELIMINARY | doubles stress rows |
| 14 | Documentation: adapter counts from the catalog, reflex-quant rows, group labels, stale comments | D2, D7, Q2, Q14 | opus 5/6, fable 2/F10 | text | PROVEN here | -- |
| 15 | TC39 single drain | Q9 | opus 12 | 8 lines | PROVEN here (counts + 33 tests) | re-notify edge case |
| 16 | Williams-square (balanced carry-over) order | X3, X4 | neon 2.6, opus O2, fable O10 | none at runtime | UNPROVEN as needed: upstream's design already shows no position effect | lite-derived: lite's sweep was engine-major in practice despite its header (B8, M8); balance proven for one shape only |
| 17 | Detached process-group kill for worker timeouts | robustness | neon section 1 | small | UNPROVEN (no lingering grandchild observed) | -- |

What upstream already does that lite-signal's bench does not (fable, opus): a fresh process per (framework,
scenario, round) with a supervising watchdog; three machine rounds with ratios taken inside one VM; chronological
raw samples for every row in the repository (which made most of this audit possible); delivery probes that check
intermediate effect values on the historical rows; production-twin and single-version bundle gates (neon); a
merge that refuses mismatched provenance.

---

## Suggested order of fixes (by severity)

| order | items | why in this place |
|---|---|---|
| 1 | D1 (pull group / pure pull), D2 (`dynamic` label), D3 (cellx effects), D7 (adapter docs: 29 vs 30, reflex-quant missing) | a written claim is broken; reproduced deterministically by >= 2 auditors; D1-D3 have patches proven on a copy |
| 2 | D4 (sample loop never yields), D5 (Angular dev mode), D6 (setup failure kind) | a written claim is broken; one auditor, reproduced deterministically here, with a patch proven on a copy (D5's size is PRELIMINARY; its mechanism is not) |
| 3 | Q1 molBench (with patch), Q2 graph-row validation, Q3 group weights, Q4 censoring drops scenarios, Q5 censor order / VM, Q6 warm-up, Q7 rank intervals, Q8 stack size, Q9 TC39 drain (with patch), Q10 layered cold, Q13 mesh topology, Q14 steady GC, Q15 unsupervised warm-up, Q16 scorer statistics, Q17 env parsing, Q18 counters / provenance, Q20 gauntlet | method choices, documented rules, or design trade-offs (weighting, censoring, warm-up, GC policy, rank intervals) that change what a row measures or how ranks form |
| 4 | Q11 adapter-bridge size, Q12 Svelte / kairo unobserved timings, Q19 adapter-detail sizes, neon's F7 GC timings and lite's 2.2 MB, every UNREPRODUCED LEAD | single-auditor and UNVERIFIED, or resting on PRELIMINARY local timing; the code facts of Q11, Q12 and Q19 are confirmed, their size needs a measured run |

Where the adapter for reflex-quant (the benchmark author's own library) differs from the others (Q11, D7), this
report states what differs and what it measurably does; it makes no claim about intent.

---

## UNREPRODUCED LEADS (merged)

| # | lead | sources | status | why only a lead |
|---|---|---|---|---|
| L-M1 | $mol_wire recomputes 910,000 nodes per invocation on a WARM pure pull, although `SEMANTICS.md:135` marks it "minimal recomputation asserted" | opus L1 | UNVERIFIED | seen on opus's patched copy with mol_wire_lib 1.0.1837 (published 1.0.1846): VERSION-SENSITIVE, no repro |
| L-M2 | manySourcesIntoOneDirectEffect: 375,000 of 400,000 writes go to sources nothing reads; half the batches run no effect | opus L3 | UNVERIFIED | counted for alien-signals only; no script |
| L-M3 | 11 `measureBuild` rows (incl. pure push) time graph construction; only push's effect installation is documented (`methodology.md:171-173`) | opus L4 | UNVERIFIED | covered for pure pull by D1; others not scripted |
| L-M4 | A tombstone (O(1)) dispose passes both lifecycle rows: retention is not checked | opus L5 | UNVERIFIED | sub-agent probe; not scripted |
| L-M5 | Mock artifacts, not gaps: a fault every 997th evaluation or 1 in 7 batched writes passes rows with few evaluations or unbatched writes | opus L8 | UNVERIFIED (mock artifact, not a gap) | recorded so nobody reads them as findings |
| L-M6 | Solid 2 RC factory flushes after root creation, the 0.13 adapter does not (docs claim one policy) | opus L9 | UNVERIFIED | not scripted |
| L-M7 | `withBuild: createRoot` with zero-arity callbacks builds unowned graphs in SolidJS 1.9 and s-js, `createScope` owned ones | fable L4 | UNVERIFIED | size unknown; solid-js VERSION-SENSITIVE |
| L-M8 | Vue 3.6: the build scope links every untracked computed read to the scope; 3.5 does not | fable L5 | UNVERIFIED | size unknown |
| L-M9 | alien-signals and dalien: `createScope` runs the cellx builder with the scope as active subscriber (one extra link per computed) | fable L6 | UNVERIFIED | cellx rows only; size unknown |
| L-M10 | $mol: `Atom.sync()` runs with the adapter subclass as `this`, so the reaper runs at most once per process | fable L7 | UNVERIFIED | consistent with $mol's heap growth (D4); not isolated |
| L-M11 | reatom: `context.reset()` in every setup disables a single-context fast path; its 7 out-of-memory rows crash inside the first invocation locally | fable L8 | UNVERIFIED | cause of the OOM rows not established |
| L-M12 | cellx library: value-returning effect callbacks take a changed-value path with an allocated event | fable L9 | UNVERIFIED | removed as a side effect of fable's cellx patch; size unknown |
| L-M13 | compostate (inactive): the stated exclusion reason cites a file not in the pinned 1.0.1 | fable L11 | UNVERIFIED | 1.0.0 not available offline |
| L-M14 | dalien: arena growth lands inside timed creation samples; the adapter excludes the handle tier on an unverified claim | fable L12 | UNVERIFIED | dalien unranked; not isolated |
| L-M15 | CI reproducibility: `ubuntu-latest`, major-version action tags, five CPU models across shards | fable L15, neon F6.3 / F12.4 | UNVERIFIED | not exercised (no hosted run) |
| L-M16 | What each patch does to the published numbers | fable L16, all | UNMEASURED | no measured run of a patched harness |
| L-M17 | neon probes not re-run here: Svelte 119.6x unobserved (Q12), kairo 2^d count, cellx unrelated-cell recompute (`repro-04b`), the steady-vs-cold timeout run (`repro-03b`), the CLI typo run (`repro-03a`), the merge of conflicting counters (`repro-05`) | neon | PRELIMINARY / UNVERIFIED | either timing (PRELIMINARY) or they start the benchmark / spawn more processes than the merge's budget; mechanisms are code-confirmed where stated |

neon's own "falsified or already fixed" list, kept: (1) note 1 fixed in 9223ec7 (agrees with X18); (2) no dynamic
node exceeds 2^53, so the `sum & 0x1` branch cannot freeze (CONFIRMED by the re-run of neon's repro-04); (3) the
`censor-start` IPC message works (the real gap is Q15; UNVERIFIED here); (4) a +1 perturbation of source 0 IS
detected by the expected sum on `layered-dag` / `deep` (CONFIRMED by the same re-run; Q2's precision limit
concerns late-layer and summation-order errors).

---

## Verification

### For this folder (2026-11-25)

Untimed; the host was shared (load average 5.1 -> 5.0 during the run, printed in `run-all.log`), so the seconds
column of `run-all.log` is wall time, not a measurement.

1. Checkout: `git archive 12f169b0f7d25de343433e3199c27d0472136185 | tar -x` into an empty directory (no other
   file), the audit host's `node_modules` copied in (versions in "Installed packages"), `node scripts/build.mjs`
   (exit 0, "Built production runner and 30 isolated framework workers."; `dist/index.js` sha256 `47017675...`),
   and this folder copied to `research/audit-2026-11-24/`.
2. `node run-all.mjs` from that folder, with no argument (target = the checkout two levels up): **20 of 20
   verdicts identical to the merge's run of 2026-11-24**: the 17 finding scripts exit 1 (REPRODUCED), the 3
   checks `x1-score-recompute`, `x2-capped-label`, `x3-gc-before-sample` exit 0 (NOT REPRODUCED); 0 CRASHED;
   run-all exit 0. Every `REPRODUCED` / `NOT REPRODUCED` line is byte-identical to the merge's (so the
   numbers match too, e.g. D4: tansu +109 MB, Svelte +80 MB per invocation; Q8: dalien and MobX overflow at the
   default stack and pass at 3000). Table under "Script results".
3. The repository was left unchanged: the sha256 of every file outside `node_modules` (336 files, including
   `dist/` and this folder) and the list of directories were identical before and after the run. Scratch went to
   `os.tmpdir()` only.
4. All 9 patches apply to the checkout (`patch --dry-run -p1`: exit 0, no fuzz, no offset; 14 file sections in
   all). They were proven by their authors on their own copies; they were NOT re-proven here (that needs patched
   builds, which neither the merge nor this folder made).
5. `node checks/check-neon-published.mjs` (default target) printed the same output as its log
   `checks/check-neon-published.log`.

### At the merge (2026-11-24)

6. The merge ran the same 20 scripts against a checkout rebuilt from `git archive` of 12f169b (same
   `dist/index.js` sha256): 20 of 20 verdicts identical to the verdict each script gave in its source audit
   (opus's own run log; fable's final run: all thirteen exit 1).
7. Untimed re-derivations for the neon-only items: `checks/check-neon-published.mjs` (log next to it), neon's
   `repro-01` and `repro-02c` (published-data scripts, re-run unmodified and read-only in a local clone at
   12f169b) and a copy of `repro-04` with SIGKILL on its child (`checks/neon-copies/`, run against the same
   clone; for this folder it takes the checkout as its argument and defaults to this repository); outputs in
   `notes/neon-rerun/`. The clone's only local changes (extra lite-signal adapter registrations in
   `src/config.ts` / `src/frameworkCatalog.json` and two untracked adapter files) are not among the modules
   `repro-04` imports.

### Script results

`node run-all.mjs` from this folder, no argument; its log is `run-all.log`. Header of that log: started
2026-11-25T01:46:07Z, node v26.8.2, V8 14.6.202.34-node.28, darwin/arm64, checkout `../..`, `dist/index.js`
sha256 `47017675...`, results source commit `f0d456c...`. One script process at a time, untimed (about 2 minutes
wall on the audit host; the merge's run on a far busier host took 12).

| script | finding | merge run (2026-11-24) | this folder (2026-11-25) |
|---|---|---|---|
| `d1-pull-group-no-dirty-reads` | D1 | 1 | 1 |
| `d2-dynamic-group-no-churn` | D2 | 1 | 1 |
| `d3-cellx-effects` | D3 | 1 | 1 |
| `d4-sync-loop-retains-fixtures` | D4 | 1 | 1 |
| `d5-angular-dev-mode` | D5 | 1 | 1 |
| `d6-setup-failure-kind` | D6 | 1 | 1 |
| `d7-adapter-docs` | D7 | 1 | 1 |
| `q1-molbench-cutoff` | Q1 | 1 | 1 |
| `q10-layered-cold-setup-work` | Q10 | 1 | 1 |
| `q2-dynamic-rows-final-state-only` | Q2 | 1 | 1 |
| `q3-score-weights` | Q3 | 1 | 1 |
| `q4-censor-exclusion` | Q4 | 1 | 1 |
| `q5-censor-order-dependent` | Q5 | 1 | 1 |
| `q6-warmup-drift` | Q6 | 1 | 1 |
| `q7-rank-sensitivity` | Q7 | 1 | 1 |
| `q8-stack-depth` | Q8 | 1 | 1 |
| `q9-tc39-drain` | Q9 | 1 | 1 |
| `x1-score-recompute` | X1 (FACT) | 0 | 0 |
| `x2-capped-label` | X18 (earlier note 1) | 0 | 0 |
| `x3-gc-before-sample` | X19 (earlier note 4) | 0 | 0 |

### Re-check of single-auditor items and neon's numbers

| item | auditor | status | how |
|---|---|---|---|
| D4 sample loop, D5 Angular, D6 failure kind | fable | CONFIRMED (re-run) | `run-all.log` |
| Q8 stack depth | opus | CONFIRMED (re-run) | `run-all.log` |
| D5 size (0.41-0.995 ratios) | fable | PRELIMINARY | one timed run on a busy host |
| Q11 bridge shapes (F2) | neon | CONFIRMED (code) | adapters re-read |
| Q11 sizes (-61% etc.) | neon | PRELIMINARY | local A/B, busy host |
| Q6 s[0] > 1.5x second half (F3) | neon | CONFIRMED: 50.6% of steady rounds (neon 50.4%), 38.9% of all (neon 38.8%); first half > 1.1x second half 20.5% (neon 20.9%); 18 rows hit the 100-sample cap below 250 ms (molBench 2.4-11.2 ms per process) | `checks/check-neon-published.log` (halves split slightly differently) |
| Q2 stale and double-eval mocks (F4.1) | neon | double-eval numbers CONFIRMED (8 of 13 with counts, 13 of 13 without); the stale-until-final mock's 8/14 and 14/14 UNVERIFIED (`repro-04b` not re-run), but the stale gap itself is reproduced by fable and opus | neon `repro-04` re-run |
| Q2 oracle precision (F4.3) | neon | CONFIRMED: final sums 1.47e24, 4.15e24, 2.28e35, 1.42e34, 3.02e241 exceed 2^53; no dynamic node exceeds 2^53; +1 on source 0 is detected | neon `repro-04` re-run |
| D3 cellx no-op effect passes (F4.2) | neon | CONFIRMED (`matches=true`); the speed ratio is PRELIMINARY | neon `repro-04` re-run |
| Q13 mesh topology (F5) | neon | CONFIRMED: 65,536 of 131,072 edges duplicate, 4 sources per leaf, 256 of 16,384 reachable, 64 clusters | neon `repro-04` re-run + code |
| Q5 ceilings, CPU rates (F6.1, F6.3) | neon | CONFIRMED | neon `repro-01` re-run |
| Q5 deferral at end of round 1 (F6.2) | neon | CONFIRMED (code) | `src/util/benchmark.ts:631-657` |
| Q15 unsupervised warm-up (F6.4) | neon | mechanism CONFIRMED (code, docs); neon's run UNVERIFIED (not re-run) | |
| Q14 spike buckets (F7) | neon | CONFIRMED | neon `repro-02c` re-run |
| Q14 GC attribution, lite 2.2 MB, cold +13-23% (F7) | neon | UNVERIFIED / PRELIMINARY | not re-run (heap / timing probes) |
| Q12 counts: kairo 174,752 on pure pull, cellx 1,572,864 / 1,966,080 (F8) | neon | CONFIRMED | published log; neon `repro-04` re-run (kairo) |
| Q12 Svelte 119.6x, kairo 2^d (F8) | neon | PRELIMINARY / UNVERIFIED | not re-run |
| Q10 build vs run split (F9) | neon | CONFIRMED | neon `repro-04` re-run, published log |
| X4 anchor slot means (F10) | neon | mechanism CONFIRMED (code); slot numbers UNVERIFIED | |
| Q18 counters absent from JSON, merge has no counter check (F11) | neon | CONFIRMED (grep: 0 `nodesRecomputed` keys; code) | synthetic merge and the "machine 2 1.26-1.56x slower" figure UNVERIFIED |
| Q16 F12.1-F12.4 | neon | CONFIRMED | neon `repro-01` re-run; F12.1 also `checks/` |
| Q7 per-round scores (F12.5) | neon | CONFIRMED: lite [1.879, 1.916, 1.910] vs rescript [1.890, 1.918, 1.916]; uSignal [2.872, 2.879, 2.981] vs reactive-engine [2.856, 2.879, 2.919] | `checks/check-neon-published.log` |
| Q17 env parsing (F13) | neon | CONFIRMED (code); neon's run UNVERIFIED (it starts the benchmark) | |
| Q9 TC39 (F14.1) | neon | CONFIRMED (opus repro re-run) | |
| Q19 Angular, kairo, cellx, Solid (F14.2-F14.5) | neon | CONFIRMED (code); sizes PRELIMINARY | |
| Q20 gauntlet (F15) | neon | CONFIRMED (node, versions); adapter divergence in `compare.mjs` UNVERIFIED | neon `repro-01` re-run |

---

## Sources: where every original item went

### neon (F1-F15 and its falsified list)

| item | merged into |
|---|---|
| F1 group weighting (pull = 1 row; push lost fan-out; dynamic = no churn) | Q3; D1 (pull part); Q4 (push part); D2 (dynamic part) |
| F2 adapter closure asymmetry | Q11 (code CONFIRMED, size PRELIMINARY) |
| F3 warm-up = 2; s[0] is the censor probe; 100-sample cap | Q6 (re-derived; see C10) |
| F4.1 stale / double-eval mocks pass graph rows | Q2; double evaluation -> X6 (C8) |
| F4.2 cellx effects unobserved | D3 |
| F4.3 ULP blindness above 2^53 | Q2 (CONFIRMED for `deep`) |
| F5 diamond mesh topology | Q13 |
| F6.1 order-dependent ceilings | Q5 |
| F6.2 deferral drained at the end of round 1 | Q5 (code CONFIRMED) |
| F6.3 CPU-correlated partials; push lost both fan-out rows | Q5, Q4 |
| F6.4 unsupervised pilot / warm-up -> FAILED(timeout) | Q15 |
| F7 steady GC setup garbage | Q14 (C2, C3) |
| F8 unobserved pull graphs, MobX keepAlive | Q12 |
| F9 layered full-drain cold | Q10 |
| F10 round-1 anchor hoisting | X4 (C1) |
| F11 counters not in JSON; merge ignores counter mismatch; no load provenance | Q18; improvement 10 |
| F12.1-F12.4 scorer statistics | Q16 (F12.1: C7) |
| F12.5 low-power rank comparisons | Q7 |
| F13 env parsing | Q17 |
| F14.1 TC39 | Q9 |
| F14.2-F14.5 Angular, kairo, cellx, Solid | Q19 |
| F15 stale semantic gauntlet | Q20 |
| falsified 1-4 | UNREPRODUCED LEADS (kept as neon's list); 1 = X18 |
| IMPROVEMENTS 2.1-2.11 | improvements 12, 5, 1/13, 7, 2/16, 8, 10, 11, 3, Q20 fix |

### opus (1-21, L1-L9, P1-P7, O1-O10)

| item | merged into |
|---|---|
| 1 molBench | Q1 (class changed to QUESTION, C4) |
| 2 pure pull | D1 |
| 3 cellx effects | D3 |
| 4 stress sink reads | Q2 (class changed to QUESTION, C5) |
| 5 reflex-quant undocumented, 29 vs 30 | D7 |
| 6 core `dynamic` label | D2 |
| 7 pull weight | Q3 |
| 8 censoring non-monotone | Q4 |
| 9 short-row drift | Q6 |
| 10 ranks 4-9 inseparable | Q7 |
| 11 dalien stack depth | Q8 |
| 12 TC39 drain | Q9 |
| Phase 3 note-3 addition | Q10 |
| FACT 13 / 14 / 15 / 16 / 17 / 18 / 19 / 20 / 21 | X2 / X1 / X3 / X5 (amended, C7) / X6 / X7 / X8 / X9 / X10 |
| L1 / L2 / L3 / L4 / L5 / L6 / L7 / L8 / L9 | L-M1 / Q19 / L-M2 / L-M3 / L-M4 / Q13 / Q15 / L-M5 / L-M6 |
| P1-P7, O1-O10 | improvements 1, 3, 5, 2, 7, 9, 10; O-items in the weakness column |

### fable (1-13, F1-F16, L1-L16, P1-P10, O1-O14)

| item | merged into |
|---|---|
| 1 pull group | D1 |
| 2 `dynamic` group | D2 |
| 3 cellx effects | D3 |
| 4 sample loop never yields | D4 |
| 5 Angular dev mode | D5 |
| 6 setup failure kind | D6 |
| 7 molBench | Q1 |
| 8 censored rows remove scenarios | Q4 |
| 9 score weights | Q3 |
| 10 censoring order / VM | Q5 |
| 11 graph rows final pass | Q2 |
| 12 warm-up | Q6 |
| 13 layered cold | Q10 |
| F1 / F2 / F3 / F4 / F5 / F6 / F7 / F8 / F9 / F10 / F11 / F12 / F13 / F14 / F15 / F16 | X1 / X3 / X3 / Q14 (C2, C3) / Q7 / X11 / X12 / X8 / X6 / D7 / X13 / X14 / X9 / X15 / X16 + Q2 / X17 |
| L1 / L2 / L3 / L4-L9 / L10 / L11 / L12 / L13 / L14 / L15 / L16 | Q11 / Q19 / Q19 / L-M7-L-M12 / Q9 / L-M13 / L-M14 / Q12 / Q12 / L-M15 / L-M16 |
| P1-P10, O1-O14 | improvements 1, 2, 2, 7, 5, 8, 5, 6, 3, 4; O-items in the weakness column |

Nothing was dropped. Items merged into another keep their numbers here.
