// The selection of exact test selection (odd/tasks/exact-tests.md, T2): which test files a gate runs, read
// from the traces of their last passing runs (./trace-reads.cjs). A test is skipped only when its trace is of
// a passing run, under this node and this tracer, and every path it recorded is as it was then; the whole
// suite runs when `package.json` changed. Anything else runs, with the reason it does.
import fs from 'node:fs';
import path from 'node:path';
import { hashOf, TRACE_PRELOAD } from './trace-reads.mjs';

/** Which of `tests` run and which are skipped: `{ run, skipped, why, full }`, `why` a map from each test that
 * runs to the reason, `full` the reason the whole suite runs or `null`. `readTrace(test)` gives a test's trace
 * or `null`; `stateOf(key)` what a recorded path is now, as the tracer would record it. */
export function selectTests({ tests, readTrace, stateOf, node = process.version, tracerHash = hashOf(TRACE_PRELOAD) }) {
  const why = new Map();
  const skipped = [];
  const states = new Map();
  const now = (key) => {
    if (!states.has(key)) states.set(key, stateOf(key));
    return states.get(key);
  };
  let full = null;
  for (const test of tests) {
    const trace = readTrace(test);
    const reason = trace === null ? 'no trace of a passing run'
      : trace.untraced ? `untraced: ${trace.untraced}`
        : trace.node !== node ? `traced under node ${trace.node}, not ${node}`
          : trace.tracerHash !== tracerHash ? 'traced by another version of the tracer'
            : changedRead(trace.reads, now);
    if (trace !== null && 'package.json' in trace.reads && now('package.json') !== trace.reads['package.json']) full ??= 'package.json changed';
    if (reason === null) skipped.push(test);
    else why.set(test, reason);
  }
  if (full !== null) return { run: [...tests], skipped: [], why: new Map(tests.map((test) => [test, full])), full };
  return { run: tests.filter((test) => why.has(test)), skipped, why, full };
}

/** The first recorded read that is not as it was, said as `<path> changed`, or `null` when none is. */
function changedRead(reads, now) {
  for (const [key, then] of Object.entries(reads)) if (now(key) !== then) return `${key} changed`;
  return null;
}

/** The names `node --test` takes for a test file by default (Node 24's patterns); any script under a
 * folder named `test` is one too. */
const TEST_NAME = /(\.test|-test|_test)\.[cm]?js$|^test-.+\.[cm]?js$|^test\.[cm]?js$/;
const SCRIPT = /\.[cm]?js$/;
const SKIPPED_FOLDERS = new Set(['node_modules', '.git']);

/** The test files of `root` that `node --test` with no file finds, from the root, `/`-separated, in order. */
export function testFilesOf(root) {
  const found = [];
  const walk = (dir, rel, inTest) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!SKIPPED_FOLDERS.has(entry.name)) walk(path.join(dir, entry.name), next, inTest || entry.name === 'test');
      } else if (entry.isFile() && (TEST_NAME.test(entry.name) || (inTest && SCRIPT.test(entry.name)))) found.push(next);
    }
  };
  walk(root, '', false);
  return found.sort();
}
