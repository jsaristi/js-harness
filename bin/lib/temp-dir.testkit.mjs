// The temporary folders of the tests: made under the OS temporary folder, and removed by the test that made them.
// Not a test file, so `node --test` does not run it; the tests import it.
//
// A test that calls `fs.mkdtempSync(path.join(os.tmpdir(), prefix))` and never removes the folder leaves it behind
// on every run: 9,601 such folders were counted in the temporary folder on 2026-11-21. `tempDir(prefix, t)` makes
// the folder and registers its
// removal with `t.after`, so it goes when that test ends, passed or failed. Without a test context (a fixture made at
// module level, a helper shared by several tests) the folder is removed when the process exits, as
// git-fixture.testkit.mjs does for its templates. A process killed from outside removes nothing; that is the one
// leak this cannot close. `bin/conventions-temp-dir.test.mjs` refuses a test file that makes its own folder there.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const atExit = new Set();

/** Removes `folder` with all it holds. A folder a child process still holds open on Windows refuses removal after
 * the retries; it stays behind rather than fail a test that passed or the run that exits. */
function remove(folder) {
  try {
    fs.rmSync(folder, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // Left behind: the one cost of not failing on it.
  }
}

process.once('exit', () => {
  for (const folder of atExit) remove(folder);
});

/** A new folder `<os.tmpdir()>/<prefix>XXXXXX`, removed with all it holds when the test of the context `t` ends
 * (`t.after`), or when the process exits if no `t` is given. A prefix that is empty or holds a path separator is
 * refused, so the folder is always a direct child of the temporary folder. */
export function tempDir(prefix, t) {
  if (typeof prefix !== 'string' || prefix === '' || /[\\/]/.test(prefix)) {
    throw new Error(`tempDir: the prefix must be a non-empty name with no path separator, not ${JSON.stringify(prefix)}`);
  }
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  if (t) {
    t.after(() => remove(folder));
  } else {
    atExit.add(folder);
  }
  return folder;
}
