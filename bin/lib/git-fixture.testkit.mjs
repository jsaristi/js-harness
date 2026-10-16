// Repositories of fixtures built once and copied (odd/tasks/gate-wait.md, T4, the third cut). Not a test file, so
// `node --test` does not run it; the tests under bin/ import it.
//
// A test that needs a repository in a known first state (an `init`, the identity in its config, a first commit)
// paid four to seven git processes for it, again in every test, and on this machine a git process costs a
// quarter of a second to a second while the suite runs. A folder copied is no process: `repoTemplate(build)`
// runs `build` once in this process, in a folder of its own, and every call after copies that folder.
//
// A copy is the same repository, byte for byte: the same commit ids, the same config, the same index. So it
// takes the place of a build only where nothing tells two copies apart by those ids: a test that pushes or
// fetches between two repositories, or that proves something is missing from one of them, builds each as it did.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const templates = new Set();

process.once('exit', () => {
  for (const folder of templates) fs.rmSync(folder, { recursive: true, force: true });
});

/** A function that copies the repository `build(root)` makes into the folder it is given, and returns what
 * `build` returned. `build` runs on the first call, in a new folder under the temporary folder; when it throws,
 * that folder is removed and the next call builds again. The template is removed when the process exits; its
 * folder is the function's `folder`, `null` before a build. */
export function repoTemplate(build) {
  let value;
  const copyTo = (dest) => {
    if (copyTo.folder === null) {
      const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-git-template-'));
      templates.add(folder);
      try {
        value = build(folder);
      } catch (err) {
        templates.delete(folder);
        fs.rmSync(folder, { recursive: true, force: true });
        throw err;
      }
      copyTo.folder = folder;
    }
    fs.cpSync(copyTo.folder, dest, { recursive: true });
    return value;
  };
  copyTo.folder = null;
  return copyTo;
}
