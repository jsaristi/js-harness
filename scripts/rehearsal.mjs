#!/usr/bin/env node
// The rehearsal of F8 S13: the whole path of the reverse-engineering document's 11.1 walked once, by this checkout's
// harness, on a scratch project in a scratch home made under the system's temp folder, the steps and their judges
// being scripts/rehearsal-lib.mjs's. Every install and uninstall runs in the scratch home with a PATH of only the
// walk's shims; only the slice's two reviews run from his environment, with --cwd on the scratch project (D2), so
// their logins answer where they live and nothing of his is linked or copied into the scratch home. His files are
// hashed before and after.
// NOT part of `npm run check`: it downloads the Codex CLI, codegraph and engram, and the reviews and the session spend
// a model. Run by hand: `node scripts/rehearsal.mjs [--keep]`. The free part is scripts/rehearsal.test.mjs.
// The design is in odd/tasks/f8-s13-rehearsal.md.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentHash } from './practice-lib.mjs';

/** Where the walk puts things under `root`: the stand-in home, the project, its bare remote, the folder of shims that
 * is the walk's whole PATH, the package prefix of what stack installs, and the record of the walk. */
export function rehearsalLayout(root) {
  const home = path.join(root, 'home');
  return {
    root,
    home,
    appData: path.join(home, 'AppData', 'Roaming'),
    localAppData: path.join(home, 'AppData', 'Local'),
    project: path.join(root, 'project'),
    remote: path.join(root, 'remote.git'),
    bin: path.join(root, 'bin'),
    prefix: path.join(root, 'prefix'),
    prefixBin: path.join(root, 'prefix', 'bin'),
    record: path.join(root, 'record.json'),
  };
}

/** The login variables no scratch child inherits: a host started there finds no login but the one a step hands it. */
const LOGINS = ['JS_HARNESS_EVAL_OAUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY'];

/** The environment of a command run in the scratch home: `base` without any login, any of git's own variables (one
 * such as GIT_DIR, set in a hook, would bind a scratch git to his repository) or a CLAUDE_CONFIG_DIR (Claude then keeps
 * `.claude.json` inside it, where stack does not read it back), with the scratch home under every name Claude Code,
 * Codex, the harness and Windows read it by. PATH is left as `base` has it; the walk hands in a base whose PATH is
 * its shims. */
export function rehearsalEnv(layout, base) {
  const dropped = (name) => LOGINS.includes(name.toUpperCase()) || /^GIT_/i.test(name) || name.toUpperCase() === 'CLAUDE_CONFIG_DIR';
  const env = Object.fromEntries(Object.entries(base).filter(([name]) => !dropped(name)));
  return {
    ...env,
    HOME: layout.home,
    USERPROFILE: layout.home,
    JS_HARNESS_HOME: layout.home,
    CODEX_HOME: path.join(layout.home, '.codex'),
    APPDATA: layout.appData,
    LOCALAPPDATA: layout.localAppData,
    DO_NOT_TRACK: '1',
  };
}

/** The hash of every file under `root`, and `folder` for every folder, by its absolute path, following no link; `{}`
 * for a folder that is not there. Folders count, since a manifest records some and one left behind must show. */
export function snapshotTree(root) {
  const snapshot = {};
  const visit = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        snapshot[file] = 'folder';
        visit(file);
      }
      else if (entry.isFile()) snapshot[file] = contentHash(fs.readFileSync(file));
    }
  };
  visit(root);
  return snapshot;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.error('the walk is not built yet (odd/tasks/f8-s13-rehearsal.md, T4)');
  process.exit(2);
}
