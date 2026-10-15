// Flaky tests: the files a red suite names, rerun once alone; one that passes then is quarantined in a committed
// ledger, docs/FLAKY.md, and does not block while its entry stands (odd/tasks/flaky-ledger.md). Zero dependencies.

// The colours a reporter may write, which would hide the words around them.
const COLOUR = /\u001b\[[0-9;]*m/g;

/** The test files a red run of node's spec reporter names, in the order it names them, each once: the
 * `test at <path>:<line>:<col>` lines after its `✖ failing tests:` summary, with `\` read as `/`, kept only
 * when the path is one of `testFiles` (paths from the repository's root). A `test at` line before the summary
 * is a test's own output, and a path that is no test file (a helper) is none of the suite's, so neither is
 * rerun: a red run that names no file blocks as it is. */
export function failedTestFiles(output, testFiles) {
  const text = String(output ?? '').replace(COLOUR, '');
  const at = text.indexOf('✖ failing tests:');
  if (at === -1) return [];
  const known = new Set(testFiles);
  const named = [];
  for (const line of text.slice(at).split(/\r?\n/)) {
    const found = /^test at (.+):\d+:\d+$/.exec(line.trim());
    if (!found) continue;
    const file = found[1].replace(/\\/g, '/');
    if (known.has(file) && !named.includes(file)) named.push(file);
  }
  return named;
}
