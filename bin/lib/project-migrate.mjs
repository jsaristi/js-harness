// The migration of a project an older release initialized (F8 S12, odd/tasks/f8-s12-migration.md; the
// reverse-engineering document, 11.2): what this copy's `init` writes that the project lacks, read from the project
// as it stands and never from its version alone (v0.97.0 is both a release that wrote no CLAUDE.md and this copy's
// version, D2). It writes the split, the pin and the coverage baseline, each recorded so `uninstall project` or git
// undoes exactly it, then hands the rest to `sync` (`syncProject`): the gate, the push check, the keys of the clone's
// settings and the blocks. It never writes outside the project, as `init` does not: context7 is said with doctor's
// fix, and what gentle-ai left is named, read-only. `candidateProjects` lists the folders the move list is chosen from.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tools } from './stack.mjs';
import { mainCheckoutOf } from './claude-import.mjs';
import { gitDirs, gitTopLevel, projectFiles, readPin } from './project.mjs';

/** How many days of sessions make a folder a candidate (the roadmap's S12, "His decisions"). */
export const CANDIDATE_DAYS = 30;

/** Where context7 is missing for the project at `root`, read as doctor's context7 row reads it, with that row's fix:
 * `[{ where, state, fix }]`, `where` being `claude`, `codex` or `project`. Nothing is registered here. */
export function context7Gaps(root, deps = {}) {
  const tool = tools.find((item) => item.id === 'context7');
  const probe = { home: deps.home ?? os.homedir(), project: root, env: deps.env ?? process.env };
  const configured = tool.configured(probe);
  const states = { claude: configured.claude, codex: configured.codex, project: tool.project(probe) };
  const fix = tool.fix(probe, configured);
  return Object.entries(states)
    .filter(([, state]) => state !== 'ok' && state !== 'n/a')
    .map(([where, state]) => ({
      where,
      state,
      // S13 saw Codex open context7's sign-in in a browser and outlive the run (odd/tasks/f8-s12-migration.md, S8).
      fix: where === 'codex' ? `${fix.codex}, in a terminal of your own: Codex opens context7's sign-in in a browser` : fix[where],
    }));
}

/** What gentle-ai left in the project at `root`, read-only: `[{ path, what, how }]` for `.atl/` (its skill registry),
 * its review store under the git common folder, and the `odd/` documents, which are the project's and stay. */
export function gentleLeftovers(root, spawn = spawnSync) {
  const found = [];
  const atl = path.join(root, '.atl');
  if (fs.existsSync(atl)) {
    const listed = spawn('git', ['ls-files', '--', '.atl'], { cwd: root, encoding: 'utf8' });
    const tracked = Boolean(listed && listed.status === 0 && listed.stdout.trim());
    const how = tracked ? 'tracked: git rm -r .atl once gentle-ai is gone' : 'not tracked: delete the folder by hand once gentle-ai is gone';
    found.push({ path: '.atl/', what: "gentle-ai's skill registry", how });
  }
  const { commonGitDir } = gitDirs(root, spawn);
  const store = commonGitDir ? path.join(commonGitDir, 'gentle-ai') : null;
  if (store && fs.existsSync(store)) {
    const relative = path.relative(root, store);
    const shown = relative.startsWith('..') || path.isAbsolute(relative) ? store : relative;
    found.push({ path: `${shown.replaceAll('\\', '/')}/`, what: "gentle-ai's review store", how: 'outside what git tracks: delete the folder by hand once gentle-ai is gone' });
  }
  if (fs.existsSync(path.join(root, 'odd'))) {
    found.push({ path: 'odd/', what: 'the task documents', how: "the project's own: they stay" });
  }
  return found;
}

/** The working folder a Claude Code transcript `file` names in its opening lines, or `null`. */
function cwdOf(file) {
  let text;
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const buffer = Buffer.alloc(256 * 1024);
      text = buffer.toString('utf8', 0, fs.readSync(fd, buffer, 0, buffer.length, 0));
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
  const found = /"cwd":"((?:[^"\\]|\\.)*)"/.exec(text);
  if (!found) return null;
  try {
    return JSON.parse(`"${found[1]}"`);
  } catch {
    return null;
  }
}

/** The folders the move list is chosen from (the roadmap's S12, "His decisions"), read-only: each folder a Claude Code
 * session under `<claudeHome>/projects` ran in, a linked worktree read as its main checkout, kept where a session ran
 * there in the last `days` days or where it is an initialized project. `[{ path, days, initialized, pin }]`, `days`
 * since its newest session, `pin` the version its `harness.json` pins or `null`; a folder that is gone is left out. */
export function candidateProjects({ claudeHome = path.join(os.homedir(), '.claude'), now = Date.now(), days = CANDIDATE_DAYS, spawn = spawnSync } = {}) {
  const base = path.join(claudeHome, 'projects');
  let folders;
  try {
    folders = fs.readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  } catch {
    return [];
  }
  const newest = new Map();
  const mains = new Map();
  for (const folder of folders) {
    const at = path.join(base, folder.name);
    for (const name of fs.readdirSync(at).filter((item) => item.endsWith('.jsonl'))) {
      const file = path.join(at, name);
      // A file written a moment ago can carry a time a little past `now`: its age is 0, never -1.
      const age = Math.max(0, Math.floor((now - fs.statSync(file).mtimeMs) / 86_400_000));
      const cwd = cwdOf(file);
      if (cwd === null || !fs.existsSync(cwd)) continue;
      if (!mains.has(cwd)) mains.set(cwd, mainCheckoutOf(cwd, spawn) ?? cwd);
      const top = path.resolve(mains.get(cwd));
      if (!newest.has(top) || newest.get(top) > age) newest.set(top, age);
    }
  }
  const found = [];
  for (const [dir, age] of newest) {
    const root = gitTopLevel(dir, spawn);
    const project = root ? projectFiles(root, spawn) : null;
    const initialized = Boolean(project?.harnessJsonPresent && project.manifestPresent);
    if (age > days && !initialized) continue;
    const pin = project?.harnessJsonPresent ? (readPin(project.harnessJsonPath).pin ?? null) : null;
    found.push({ path: dir, days: age, initialized, pin });
  }
  return found.sort((a, b) => a.path.localeCompare(b.path));
}
