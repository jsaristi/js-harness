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
//
// Since git 2.47 a commit, a merge or a push received starts `git maintenance run --auto --detach`, which takes
// `<objects>/maintenance.lock` and outlives the command that started it. A copy made while it runs can list the
// lock and find it gone, and stops with ENOENT (rules-row-template-copy-enoent in docs/FAILURES.md). So a build
// runs with automatic maintenance off, and every repository it made keeps it off in its config, for its copies.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const templates = new Set();

/** Runs `run` with automatic git maintenance off for every git it starts that inherits this process's
 * environment, through one more `GIT_CONFIG_COUNT` entry after the caller's own, and puts the environment back as
 * it was when `run` returns or throws. Returns what `run` returned. */
export function withoutAutoMaintenance(run) {
  const count = Number(process.env.GIT_CONFIG_COUNT ?? 0);
  const names = ['GIT_CONFIG_COUNT', `GIT_CONFIG_KEY_${count}`, `GIT_CONFIG_VALUE_${count}`];
  const saved = names.map((name) => [name, process.env[name]]);
  process.env.GIT_CONFIG_COUNT = String(count + 1);
  process.env[`GIT_CONFIG_KEY_${count}`] = 'maintenance.auto';
  process.env[`GIT_CONFIG_VALUE_${count}`] = 'false';
  try {
    return run();
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

/** Turns automatic git maintenance off in the config of every repository under `folder`, bare ones included: a
 * folder that holds a `HEAD` file, an `objects` folder and a `config` file is one. Written as text, with no git
 * process. */
export function autoMaintenanceOff(folder) {
  const entries = fs.readdirSync(folder, { withFileTypes: true });
  const has = (name, kind) => entries.some((entry) => entry.name === name && entry[kind]());
  if (has('HEAD', 'isFile') && has('objects', 'isDirectory') && has('config', 'isFile')) {
    fs.appendFileSync(path.join(folder, 'config'), '[maintenance]\n\tauto = false\n');
  }
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'objects') autoMaintenanceOff(path.join(folder, entry.name));
  }
}

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
        value = withoutAutoMaintenance(() => build(folder));
        autoMaintenanceOff(folder);
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
