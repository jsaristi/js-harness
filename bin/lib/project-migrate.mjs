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
import { importsAgents, mainCheckoutOf } from './claude-import.mjs';
import { checkProjectRules, PROJECT_RULES_PATH } from './project-rules.mjs';
import { isNewer } from './version.mjs';
import { localDay } from './flaky.mjs';
import { renderBlock, TEMPLATE_BLOCK_MARK } from './project-template.mjs';
import {
  agentsBlock,
  claudeBlock,
  claudeTemplate,
  clonePending,
  gitDirs,
  gitTopLevel,
  projectFiles,
  readPin,
  readRecorded,
  templateBlock,
} from './project.mjs';

/** The committed files the migration may write, which git must be able to give back exactly. */
const COMMITTED = ['harness.json', 'AGENTS.md', 'CLAUDE.md'];

/** The `CLAUDE.md` written beside an `AGENTS.md` whose block was edited: the import alone, so no line is said twice. */
export const IMPORT_ONLY = `<!-- Written by \`js-harness migrate\`. Claude loads this file and the AGENTS.md it imports on every turn; AGENTS.md keeps the harness's lines, since its block was edited. -->
@AGENTS.md
`;

/** How many days of sessions make a folder a candidate (the roadmap's S12, "His decisions"). */
export const CANDIDATE_DAYS = 30;

/** The file `name` of `root`: `{ state: 'file', text }`, `{ state: 'link' }` or `{ state: 'absent' }`. */
function fileOf(root, name) {
  const file = path.join(root, name);
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    return { state: 'absent' };
  }
  if (stat.isSymbolicLink()) return { state: 'link' };
  if (!stat.isFile()) return { state: 'other' };
  return { state: 'file', text: fs.readFileSync(file, 'utf8') };
}

/** The project at `cwd` read and validated before anything is decided, with the refusals `sync` gives and two of its
 * own: `pinNewer`, a pin this copy is older than, and `notSetUp`, a clone `sync` has not set up yet. */
function inspect(cwd, version, deps) {
  const spawn = deps.spawn ?? spawnSync;
  if (!fs.existsSync(cwd)) return { code: 1, noSuchDirectory: true, cwd };
  const root = gitTopLevel(cwd, spawn);
  if (!root) return { code: 1, notGitRepo: true };
  const files = projectFiles(root, spawn);
  if (!files.harnessJsonPresent && !files.manifestPresent) return { code: 1, notInitialized: true };
  if (!files.harnessJsonPresent) return { code: 1, staleManifest: true, manifestPath: files.manifestFilePath };
  if (!files.manifestPresent) return { code: 1, notSetUp: true, root };
  const pinned = readPin(files.harnessJsonPath);
  if (pinned.invalid) return { code: 1, invalidHarnessJson: true, harnessJsonPath: files.harnessJsonPath, reason: pinned.invalid };
  if (pinned.noPin) return { code: 1, noPin: true, harnessJsonPath: files.harnessJsonPath, version };
  if (isNewer(pinned.pin, version)) return { code: 1, pinNewer: true, pin: pinned.pin, version };
  const read = readRecorded(root, files.manifestFilePath, spawn);
  if (read.code) return read;
  return { code: 0, root, spawn, files, pin: pinned.pin, manifest: read.manifest };
}

/** `text`, a `harness.json`, with the value of its `"version"` moved from `from` to `to` and every other byte kept, or
 * `null` where that value is not there exactly once. */
export function movedPin(text, from, to) {
  const pattern = new RegExp(`("version"\\s*:\\s*)"${from.replace(/[.+]/g, '\\$&')}"`, 'g');
  if ((text.match(pattern) ?? []).length !== 1) return null;
  const moved = text.replace(pattern, `$1"${to}"`);
  try {
    return JSON.parse(moved).version === to ? moved : null;
  } catch {
    return null;
  }
}

/** The findings a baseline dated `day` would add to `rules check` in the project at `root`: `[]` where it has no list
 * or every live rule already names its control. */
function baselineFindings(root, day) {
  const list = fileOf(root, PROJECT_RULES_PATH);
  if (list.state !== 'file') return [];
  const readFile = (file) => {
    const found = fileOf(root, file);
    return found.state === 'file' ? found.text : null;
  };
  const without = new Set(checkProjectRules({ text: list.text, readFile, sensors: null }).findings);
  return checkProjectRules({ text: list.text, readFile, sensors: null, baseline: day }).findings.filter((finding) => !without.has(finding));
}

/** What the migration writes into the project `state` read, and what it leaves with a note: `{ pin, claude,
 * baseline, notes }`, each write `null` where there is none to make. A pin that cannot be moved in place is a refusal. */
function decide(state, version, deps) {
  const { root, files, pin, manifest } = state;
  const notes = [];
  let pinWrite = null;
  if (pin !== version) {
    const before = fs.readFileSync(files.harnessJsonPath, 'utf8');
    const after = movedPin(before, pin, version);
    if (after === null) return { refusal: { code: 1, pinUnmovable: true, harnessJsonPath: files.harnessJsonPath, pin, version } };
    pinWrite = { from: pin, to: version, before, after };
  }

  // The split (odd/tasks/f8-s3-split.md, S3; D3): CLAUDE.md is written only where there is none.
  let claude = null;
  const agentsFile = fileOf(root, 'AGENTS.md');
  const claudeFile = fileOf(root, 'CLAUDE.md');
  if (claudeFile.state === 'absent') {
    if (agentsFile.state === 'file') {
      const block = renderBlock(agentsFile.text, templateBlock()).state;
      claude = block === 'edited' ? { text: IMPORT_ONLY, importOnly: true } : { text: claudeTemplate(), importOnly: false };
      if (block === 'edited') notes.push({ path: 'AGENTS.md', reason: "its block of the harness's lines was edited, so it keeps them whole and CLAUDE.md imports it alone" });
      if (block === 'none') notes.push({ path: 'AGENTS.md', reason: "the project's own, with no block of the harness's lines: what good looks like is not in it" });
    } else {
      notes.push({ path: 'AGENTS.md', reason: `${agentsFile.state === 'absent' ? 'not there' : 'not a regular file'}, so no CLAUDE.md is written to import it: a file the project deleted stays deleted` });
    }
  } else if (claudeFile.state === 'file' && !importsAgents(claudeFile.text) && agentsFile.state === 'file') {
    notes.push({ path: 'CLAUDE.md', reason: "the project's own, and it does not import AGENTS.md, so Claude never loads it: add a line `@AGENTS.md` (doctor's claude-import row)" });
  }

  // The baseline (the reverse-engineering document, 14.3; D5): only where it adds no finding to `rules check`.
  let baseline = null;
  if (manifest.coverage === undefined) {
    const day = deps.today ?? localDay();
    const added = baselineFindings(root, day);
    if (added.length === 0) baseline = day;
    else notes.push({ path: 'the coverage baseline', reason: `not recorded: it would make ${added.length === 1 ? 'a finding' : `${added.length} findings`} of rules check: ${added.join('; ')}` });
  }
  return { pin: pinWrite, claude, baseline, notes };
}

/** The committed files of `COMMITTED` that git sees changed or untracked in the project at `root`. */
function uncommittedOf(root, spawn) {
  const result = spawn('git', ['status', '--porcelain', '--', ...COMMITTED], { cwd: root, encoding: 'utf8' });
  if (!result || result.error || result.status !== 0) return [...COMMITTED];
  return result.stdout.split('\n').filter(Boolean).map((line) => line.slice(3).trim()).filter((name) => COMMITTED.includes(name));
}

/** The lines `sync` would render in the blocks once the migration's `CLAUDE.md` is there. */
function blockLines(root, decided) {
  const lines = [];
  const claudeFile = fileOf(root, 'CLAUDE.md');
  const split = (decided.claude && !decided.claude.importOnly) || (claudeFile.state === 'file' && TEMPLATE_BLOCK_MARK.test(claudeFile.text));
  const agentsFile = fileOf(root, 'AGENTS.md');
  if (agentsFile.state === 'file' && renderBlock(agentsFile.text, split ? agentsBlock() : templateBlock()).state === 'rendered') {
    lines.push("AGENTS.md: its block is rendered again with this version's lines");
  }
  if (claudeFile.state === 'file' && renderBlock(claudeFile.text, claudeBlock()).state === 'rendered') {
    lines.push("CLAUDE.md: its block is rendered again with this version's lines");
  }
  return lines;
}

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

/** What `migrate` would write in the project at `cwd`, read-only: `{ code: 0, root, pending, notes, uncommitted,
 * leftovers, context7 }`, `pending` one line a write and empty where there is nothing to do; or the refusal. */
export function migrationPlan(cwd, version, deps = {}) {
  const state = inspect(cwd, version, deps);
  if (state.code) return state;
  const decided = decide(state, version, deps);
  if (decided.refusal) return decided.refusal;
  const pending = [];
  if (decided.pin) pending.push(`harness.json: the pin ${decided.pin.from} moves to ${decided.pin.to}`);
  if (decided.claude) pending.push(`CLAUDE.md: written, importing AGENTS.md${decided.claude.importOnly ? ' alone' : " and holding the harness's lines for Claude"}`);
  if (decided.baseline) pending.push(`the coverage baseline: recorded as ${decided.baseline}`);
  if (state.manifest.version !== version && !decided.pin) pending.push(`the manifest: records ${version}`);
  pending.push(...blockLines(state.root, decided), ...clonePending(state.root, { spawn: state.spawn }));
  return {
    code: 0,
    root: state.root,
    pending,
    notes: decided.notes,
    uncommitted: uncommittedOf(state.root, state.spawn),
    leftovers: gentleLeftovers(state.root, state.spawn),
    context7: context7Gaps(state.root, deps),
  };
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
