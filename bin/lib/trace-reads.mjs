// The tracer of exact test selection, as the rest of the harness uses it (odd/tasks/exact-tests.md, T1): the
// path of its preload (./trace-reads.cjs, CommonJS since --require takes one), the environment that turns it
// on for a run, and the reading of a trace it wrote.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const tracer = require('./trace-reads.cjs');

/** The preload, for `NODE_OPTIONS=--require=<path>`. */
export const TRACE_PRELOAD = path.join(path.dirname(fileURLToPath(import.meta.url)), 'trace-reads.cjs');

/** The version of what a trace records; a trace of another version is no trace. */
export const TRACER_VERSION = tracer.TRACER_VERSION;

/** The variables of a run's environment a trace keeps in its key (S5), and their values in `env`. */
export const TRACE_ENV = tracer.TRACE_ENV;
export const traceEnvOf = tracer.traceEnvOf;

/** The hash of a file's content, as a trace keeps it, or `null`. */
export const hashOf = tracer.hashOf;

/** What a path a trace recorded is now, as the trace would keep it (`absent`, a listing, a hash). */
export const stateOf = tracer.stateOf;

/** The variables that trace a run of the tests of `root` into `dir`: the preload after the `NODE_OPTIONS`
 * given (`existing`), quoted when its path holds a space, and the two settings the preload reads. */
export function traceEnv({ root, dir, existing = '' }) {
  const require = /\s/.test(TRACE_PRELOAD) ? `--require="${TRACE_PRELOAD.replace(/[\\"]/g, '\\$&')}"` : `--require=${TRACE_PRELOAD}`;
  return {
    NODE_OPTIONS: `${existing ?? ''} ${require}`.trim(),
    JS_HARNESS_TRACE_DIR: dir,
    JS_HARNESS_TRACE_ROOT: path.resolve(root),
  };
}

/** The trace of `test` (its path from the repository root, `/`-separated) in `dir`, or `null` when there is
 * none, it cannot be read, or it is of another tracer. */
export function readTrace(dir, test) {
  try {
    const trace = JSON.parse(fs.readFileSync(path.join(dir, tracer.traceName(test)), 'utf8'));
    return trace?.tracer === TRACER_VERSION && trace.test === test && trace.reads && typeof trace.reads === 'object' ? trace : null;
  } catch {
    return null;
  }
}
