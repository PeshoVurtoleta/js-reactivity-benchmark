// Exit protocol shared by every repro-*.mjs:
//   exit 1 only after a line starting with REPRODUCED
//   exit 0 only after a line starting with NOT REPRODUCED
//   exit 2 on anything else (import failure, failed control, unexpected throw)
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCRATCH_ROOT, defaultTarget } from "../scratch.mjs";

// lib/fable/../.. = this folder. Published results, docs and src/ are read from the target checkout: argv[2],
// else $AUDIT_TARGET, else the repository root two levels above this folder (lib/scratch.mjs).
export const AUDIT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_RUN = defaultTarget();
export const BASE = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : DEFAULT_RUN;
export const TMP = path.join(SCRATCH_ROOT, "fable"); // outside the repository
export const PUBLISHED_SAMPLES = path.join(BASE, "bench-results", "latest.samples.json");
export const PUBLISHED_LOG = path.join(BASE, "bench-results", "latest.log");

/** First CLI argument = path of the target checkout (default: see above), resolved against cwd. */
export function runCopy() {
  const arg = process.argv[2];
  return arg ? path.resolve(process.cwd(), arg) : DEFAULT_RUN;
}

export class ControlFailed extends Error {}
export function control(ok, text) {
  console.log(`  control: ${text}: ${ok ? "ok" : "FAILED"}`);
  if (!ok) throw new ControlFailed(`control failed: ${text}`);
}

/** body() returns { reproduced: boolean, summary: string }. */
export async function verdict(body) {
  let result;
  try {
    result = await body();
    if (!result || typeof result.reproduced !== "boolean") throw new Error("repro body returned no verdict");
  } catch (error) {
    console.log(`ERROR (no verdict): ${error?.stack ?? error}`);
    process.exit(2);
  }
  if (result.reproduced) {
    console.log(`REPRODUCED: ${result.summary}`);
    process.exit(1);
  }
  console.log(`NOT REPRODUCED: ${result.summary}`);
  process.exit(0);
}
