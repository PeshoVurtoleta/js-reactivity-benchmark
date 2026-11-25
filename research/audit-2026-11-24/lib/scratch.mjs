// Where the corpus reads from and where it writes to.
// - Target: the benchmark checkout whose src/, dist/, docs and bench-results/ the scripts read. Default: the
//   repository root two levels above this folder (research/audit-2026-11-24/../..). Override with the first
//   CLI argument of a script, or with the environment variable AUDIT_TARGET.
// - Scratch (bundles, child-process output, TMPDIR of children): always OUTSIDE the repository, in an
//   os.tmpdir() directory, so a run leaves `git status` clean. run-all.mjs creates one and hands it to every
//   script as AUDIT_SCRATCH (and keeps it: the per-script outputs are there). A script run by hand creates
//   its own and removes it when it exits.
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const AUDIT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function defaultTarget() {
  return process.env.AUDIT_TARGET ? path.resolve(process.env.AUDIT_TARGET) : path.resolve(AUDIT_DIR, "..", "..");
}

const inherited = process.env.AUDIT_SCRATCH;
export const SCRATCH_ROOT = inherited ? path.resolve(inherited) : mkdtempSync(path.join(os.tmpdir(), "jrb-audit-"));
mkdirSync(SCRATCH_ROOT, { recursive: true });
process.env.AUDIT_SCRATCH = SCRATCH_ROOT; // children inherit it
if (!inherited) process.on("exit", () => { try { rmSync(SCRATCH_ROOT, { recursive: true, force: true }); } catch {} });
