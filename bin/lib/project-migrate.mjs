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
import { sha256, writeManifestAtomic } from './manifest.mjs';
import { tools } from './stack.mjs';
import { importsAgents, mainCheckoutOf } from './claude-import.mjs';
import { checkProjectRules, PROJECT_RULES_PATH } from './project-rules.mjs';
import { isNewer } from './version.mjs';
import { localDay } from './flaky.mjs';
import { renderBlock, TEMPLATE_BLOCK_MARK } from './project-template.mjs';
import {
  InitWriteError,
  agentsBlock,
  claudeBlock,
  claudeTemplate,
  clonePending,
  excludeFile,
  gitDirs,
  gitTopLevel,
  matchesRecordedHash,
  projectFiles,
  readPin,
  readRecorded,
  resolveManifestEntryPath,
  syncProject,
  templateBlock,
} from './project.mjs';

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
    // Through a link the write would change its target, which git cannot give back (Codex, 2026-10-30).
    if (fs.lstatSync(files.harnessJsonPath).isSymbolicLink()) {
      return { refusal: { code: 1, pinUnmovable: true, link: true, harnessJsonPath: files.harnessJsonPath, pin, version } };
    }
    const before = fs.readFileSync(files.harnessJsonPath, 'utf8');
    const after = movedPin(before, pin, version);
    if (after === null) return { refusal: { code: 1, pinUnmovable: true, harnessJsonPath: files.harnessJsonPath, pin, version } };
    pinWrite = { from: pin, to: version, before, after };
  }

  // The split (odd/tasks/f8-s3-split.md, S3; D3): CLAUDE.md is written only where there is none.
  let claude = null;
  const agentsFile = fileOf(root, 'AGENTS.md');
  const claudeFile = fileOf(root, 'CLAUDE.md');
  const claudeRecorded = manifest.files.some((file) => file.path === 'CLAUDE.md');
  if (claudeFile.state === 'absent' && claudeRecorded) {
    notes.push({ path: 'CLAUDE.md', reason: 'init wrote it and the project deleted it, so it is not written again: a file the project deleted stays deleted' });
  } else if (claudeFile.state === 'absent') {
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

/** The committed files the migration or sync after it may write in the project `state` read, as `decided`, which git
 * must be able to give back exactly: `harness.json` where the pin moves, and a file holding a block of the harness's
 * lines, which sync renders. A file of the project's with no block is neither's to write, so its state stops nothing. */
function writable(state, decided) {
  const names = decided.pin ? ['harness.json'] : [];
  // A CLAUDE.md it writes where there is none: a deletion git has not committed would be covered by it (Codex).
  if (decided.claude) names.push('CLAUDE.md');
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const file = fileOf(state.root, name);
    if (file.state === 'file' && TEMPLATE_BLOCK_MARK.test(file.text)) names.push(name);
  }
  return names;
}

/** The files of `names` that git sees changed, untracked or ignored in the project at `root`: git could give none of
 * them back. */
function uncommittedOf(root, spawn, names) {
  if (names.length === 0) return [];
  // Every untracked file whatever the clone's config says, and no refresh of the index, which a plan must not write.
  const args = ['--no-optional-locks', 'status', '--porcelain', '--ignored', '--untracked-files=all', '--', ...names];
  const result = spawn('git', args, { cwd: root, encoding: 'utf8' });
  if (!result || result.error || result.status !== 0) return [...names];
  return result.stdout.split('\n').filter(Boolean).map((line) => line.slice(3).trim()).filter((name) => names.includes(name));
}

/** What `sync` repairs in the clone that `clonePending` does not read (`updateRecorded`): the pre-commit gate of a
 * manifest `functions apply` wrote or a recorded one that is gone, and the `.atl/` exclude line of a clone with no
 * record of it. */
function repairLines({ root, manifest, spawn }) {
  const lines = [];
  const gate = manifest.files.find((file) => file.path.split('/').pop() === 'pre-commit');
  if (manifest.scope === 'functions') lines.push('the pre-commit gate: written, as sync sets the clone up the rest of the way');
  else if (gate && !fs.existsSync(resolveManifestEntryPath(root, gate))) lines.push('the pre-commit gate: written again, since the one recorded is gone');
  // Only where sync would write it: an exclude file behind a link, or outside the repository, sync keeps as it is.
  if (!manifest.exclude) {
    const target = excludeFile(root, spawn);
    if (target.file && !target.reason) lines.push(".atl/: its exclude line added to the clone's exclude file and recorded");
  }
  return lines;
}

/** The lines `sync` would render in the blocks once the migration's `CLAUDE.md` is there. Whether the project has the
 * split is read as sync reads it, through a `CLAUDE.md` that is a link (`blockFileOf`), so the plan says what it does. */
function blockLines(root, decided) {
  const lines = [];
  const claudeFile = fileOf(root, 'CLAUDE.md');
  let claudeText = claudeFile.text;
  if (claudeFile.state === 'link') {
    try {
      claudeText = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    } catch {
      claudeText = undefined; // A link to nothing that can be read: sync finds no block either.
    }
  }
  const split = (decided.claude && !decided.claude.importOnly) || (claudeText !== undefined && TEMPLATE_BLOCK_MARK.test(claudeText));
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
  pending.push(...repairLines(state), ...blockLines(state.root, decided), ...clonePending(state.root, { spawn: state.spawn }));
  return {
    code: 0,
    root: state.root,
    pending,
    notes: decided.notes,
    uncommitted: uncommittedOf(state.root, state.spawn, writable(state, decided)),
    leftovers: gentleLeftovers(state.root, state.spawn),
    context7: context7Gaps(state.root, deps),
  };
}

/** Migrates the project at `cwd` to `version`: writes `CLAUDE.md`, the pin and the baseline as `decide` says and
 * records them in the project manifest, then runs `syncProject`. Returns `{ code, root, actions, notes, leftovers,
 * context7, committed, upToDate }`, `committed` the committed files written, which git undoes; or a refusal, with
 * nothing written: one of `migrationPlan`'s, or `uncommitted`, the files it would write that hold a change git has not
 * committed. A write that fails takes back every one before it and throws `InitWriteError`; one of `sync`'s throws as
 * `sync` does, after this part is recorded. */
export function migrateProject(cwd, version, deps = {}) {
  const state = inspect(cwd, version, deps);
  if (state.code) return state;
  const { root, files } = state;
  const decided = decide(state, version, deps);
  if (decided.refusal) return decided.refusal;
  const uncommitted = uncommittedOf(root, state.spawn, writable(state, decided));
  if (uncommitted.length > 0) return { code: 1, uncommitted, root };

  const writeFile = deps.writeFile ?? fs.writeFileSync;
  const removeFile = deps.removeFile ?? fs.rmSync;
  const manifestDeps = { open: deps.open, write: deps.write, close: deps.close };
  const next = JSON.parse(JSON.stringify(state.manifest));
  const actions = [];
  const committed = new Set();
  const undo = [];
  try {
    // Each undo is registered before its write, so a write that fails halfway is taken back too (Codex, 2026-10-30).
    if (decided.claude) {
      const target = path.join(root, 'CLAUDE.md');
      undo.push({ path: 'CLAUDE.md', run: () => removeFile(target, { force: true }) });
      writeFile(target, decided.claude.text, 'utf8');
      const hash = sha256(decided.claude.text);
      next.files.push({ path: 'CLAUDE.md', sha256: hash });
      actions.push({ kind: 'wrote', path: 'CLAUDE.md', sha256: hash });
      committed.add('CLAUDE.md');
    }
    if (decided.pin) {
      const { from, to, before, after } = decided.pin;
      undo.push({ path: 'harness.json', run: () => writeFile(files.harnessJsonPath, before, 'utf8') });
      writeFile(files.harnessJsonPath, after, 'utf8');
      // The record follows the new bytes only while they were the bytes init wrote (D4), CRLF from a checkout read as
      // the LF init wrote: an edited file stays the project's.
      const entry = next.files.find((file) => file.path === 'harness.json');
      if (entry && matchesRecordedHash(before, entry.sha256)) entry.sha256 = sha256(after.replace(/\r\n/g, '\n'));
      actions.push({ kind: 'pinMoved', path: 'harness.json', from, to });
      committed.add('harness.json');
    }
    if (decided.baseline) {
      next.coverage = { baseline: decided.baseline, release: version };
      actions.push({ kind: 'baseline', day: decided.baseline });
    }
    if (actions.length > 0) writeManifestAtomic(files.manifestFilePath, next, manifestDeps);
  } catch (err) {
    const notRemoved = [];
    for (const step of [...undo].reverse()) {
      try {
        step.run();
      } catch {
        notRemoved.push(step.path);
      }
    }
    throw new InitWriteError(err.message, notRemoved);
  }

  let synced;
  try {
    synced = (deps.syncProject ?? syncProject)(root, version, deps);
  } catch (err) {
    // Sync takes back only its own writes, and whatever it throws, the migration's stay, recorded: its reader is told which.
    if (err instanceof Error) err.migrated = actions.map((action) => (action.kind === 'baseline' ? 'the coverage baseline' : action.path));
    throw err;
  }
  for (const action of synced.actions ?? []) if (action.kind === 'rendered') committed.add(action.path);
  return {
    ...synced,
    root,
    actions: [...actions, ...(synced.actions ?? [])],
    notes: decided.notes,
    leftovers: gentleLeftovers(root, state.spawn),
    context7: context7Gaps(root, deps),
    committed: [...committed],
    upToDate: actions.length === 0 && synced.upToDate === true,
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
 * session under `<claudeHome>/projects` ran in, a linked worktree read as its main checkout and a folder inside a
 * repository as its top level, kept where a session ran
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
    // A folder or a session that cannot be read, as one removed while this reads, names no project: the scan goes on
    // (gentle-ai, 2026-10-30).
    let names = [];
    try {
      names = fs.readdirSync(at).filter((item) => item.endsWith('.jsonl'));
    } catch {
      continue;
    }
    for (const name of names) {
      const file = path.join(at, name);
      let modified;
      try {
        modified = fs.statSync(file).mtimeMs;
      } catch {
        continue;
      }
      // A file written a moment ago can carry a time a little past `now`: its age is 0, never -1.
      const age = Math.max(0, Math.floor((now - modified) / 86_400_000));
      const cwd = cwdOf(file);
      if (cwd === null || !fs.existsSync(cwd)) continue;
      // A folder inside a repository, such as a worktree's folder git no longer links, is read as its top level.
      if (!mains.has(cwd)) mains.set(cwd, mainCheckoutOf(cwd, spawn) ?? gitTopLevel(cwd, spawn) ?? cwd);
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
