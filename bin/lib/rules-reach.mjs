// `js-harness rules --hook`: letter F's turn-start hook (odd/tasks/rule-hierarchy.md, "Reach: the turn-start hook
// (T16f, first part)"). At the start of a turn, after a compaction, a clear or a resume, and at a sub-agent's start, it
// tells the session what the rules on the default branch say that the session's merge base does not, once. It acts
// only in a project that declares rules, never blocks, and answers in the hooks contract. It is a module of its own so
// that a turn loads only what it needs: the dispatcher sends `rules --hook` here without loading bin/rules.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { HASH_KEYS } from './rules.mjs';
import { parseProjectRules, PROJECT_RULES_PATH } from './project-rules.mjs';
import { harnessHome } from './home.mjs';
import { isSessionId } from './session-id.mjs';

/** Where the harness's own checkout keeps its list, from its git top. */
export const HARNESS_LIST = 'bin/lib/rules-data.mjs';
// What a list is reduced to before two are compared: the keys the hash reads, and a project rule's sensor.
const COMPARED = [...HASH_KEYS, 'sensor'];
// The default branch, in the order it is looked for: the remote's own head, then the usual names.
export const MAIN_REFS = [
  ['origin/HEAD', 'refs/remotes/origin/HEAD'],
  ['origin/main', 'refs/remotes/origin/main'],
  ['main', 'refs/heads/main'],
];
// The sources of `SessionStart` after which what the context held may be gone, so the session is told again.
const RETOLD = new Set(['compact', 'clear', 'resume']);
// A session's record that has not been written for this long is pruned at the next write.
const PRUNE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const USAGE = 'Usage: js-harness rules --hook (reads a Claude Code hook input on standard input)';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The rules of a list's `text` as git gave it, as `{ rules }` or `{ fault }`. `harness` is the one shape
 * `writeRules` writes, read as JSON and never imported; `project` is a project's `docs/rules.json`. */
export function readListText(text, kind) {
  if (kind === 'project') {
    const { rules, faults } = parseProjectRules(text);
    return rules ? { rules } : { fault: faults.join('; ') };
  }
  const start = text.indexOf('export const RULES = ');
  const end = text.lastIndexOf(';');
  if (start < 0 || end < start) return { fault: `${HARNESS_LIST} is not in the shape writeRules gives` };
  try {
    const rules = JSON.parse(text.slice(start + 'export const RULES = '.length, end));
    return Array.isArray(rules) ? { rules } : { fault: `${HARNESS_LIST} holds no list` };
  } catch (err) {
    return { fault: `${HARNESS_LIST} is not in the shape writeRules gives: ${err.message}` };
  }
}

/** `rule` reduced to the compared keys, in their order. */
function reduce(rule) {
  const out = {};
  for (const key of COMPARED) if (Object.hasOwn(rule, key)) out[key] = rule[key];
  return out;
}

const byId = (list) => [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** What `after` says that `before` does not, by id: rules added, removed, newly retired, and otherwise changed in
 * a compared key. A rule that only moved, or changed a key that is not compared (its source, subject or row), is in
 * no group. */
export function diffRules(before, after) {
  const was = new Map(before.map((rule) => [rule.id, reduce(rule)]));
  const now = new Map(after.map((rule) => [rule.id, reduce(rule)]));
  const diff = { added: [], removed: [], retired: [], changed: [] };
  for (const rule of byId([...now.values()])) {
    const earlier = was.get(rule.id);
    if (earlier === undefined) diff.added.push(rule);
    else if (Object.hasOwn(rule, 'retired') && !Object.hasOwn(earlier, 'retired')) diff.retired.push(rule);
    else if (!same(earlier, rule)) diff.changed.push({ id: rule.id, before: earlier, after: rule });
  }
  for (const rule of byId([...was.values()])) if (!now.has(rule.id)) diff.removed.push(rule);
  return diff;
}

/** A value with its unit, as a person says it. */
const amount = (rule) => (Object.hasOwn(rule, 'value') ? `${rule.value}${rule.unit ? ` ${rule.unit}` : ''}` : 'none');
const shown = (value) => (value === undefined ? 'none' : JSON.stringify(value));

/** What a rule declares, in a few words: its value, or the home of a rule in prose. */
function declared(rule) {
  if (Object.hasOwn(rule, 'value')) return amount(rule);
  if (Object.hasOwn(rule, 'path')) return `its home is ${rule.path}, phrases ${shown(rule.phrases)}`;
  if (Object.hasOwn(rule, 'sensor')) return `held by the sensor ${rule.sensor}`;
  return 'declared';
}

/** The line of one changed rule: its value and unit together, then each other compared key that differs. */
function changeLine({ id, before, after }) {
  const parts = [];
  if (!same(before.value, after.value) || !same(before.unit, after.unit)) parts.push(`${amount(before)} -> ${amount(after)}`);
  for (const key of COMPARED) {
    if (['id', 'value', 'unit'].includes(key) || same(before[key], after[key])) continue;
    parts.push(`${key} ${shown(before[key])} -> ${shown(after[key])}`);
  }
  return `- ${id}: ${parts.join('; ')}`;
}

/** The notice for `diff` against `mainRef`, or `null` when there is nothing to tell. It carries the declarations
 * on `mainRef` themselves, since `js-harness rules <id>` prints the installed copy's list, never the branch's. */
export function rulesNotice(diff, mainRef) {
  const lines = [
    ...diff.added.map((rule) => ({ id: rule.id, line: `- ${rule.id} (new): ${declared(rule)}` })),
    ...diff.removed.map((rule) => ({ id: rule.id, line: `- ${rule.id}: no longer declared on ${mainRef}` })),
    ...diff.retired.map((rule) => ({
      id: rule.id,
      line: `- ${rule.id}: retired; ${(rule.successors ?? []).length > 0 ? `read ${rule.successors.join(', ')} instead` : 'no rule replaces it'}`,
    })),
    ...diff.changed.map((change) => ({ id: change.id, line: changeLine(change) })),
  ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (lines.length === 0) return null;
  return [
    `The rules on ${mainRef} differ from this checkout's (${lines.length} ${lines.length === 1 ? 'rule' : 'rules'}):`,
    ...lines.map(({ line }) => line),
    `These are ${mainRef}'s; this branch's own checks still read the old ones until ${mainRef} is merged into it.`,
  ].join('\n');
}

/** The git top `cwd` is in, the nearest folder up that holds `.git` (a folder, or a worktree's file), found with
 * no git process; `null` outside a repository. */
function gitTop(cwd) {
  for (let dir = cwd; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    if (path.dirname(dir) === dir) return null;
  }
}

/** The list the project at `top` declares, `{ path, kind }`, or `null` for a project that declares none. */
export function listOf(top) {
  if (fs.existsSync(path.join(top, HARNESS_LIST))) return { path: HARNESS_LIST, kind: 'harness' };
  if (fs.existsSync(path.join(top, PROJECT_RULES_PATH))) return { path: PROJECT_RULES_PATH, kind: 'project' };
  return null;
}

/** The record of a session's last seen list. */
const seenPath = (home, sessionId) => path.join(home, '.js-harness', 'channel', 'rules-seen', `${sessionId}.json`);

/** The last seen list of a session with the project's top and the main ref and commit it was read at,
 * `{ list, top, main, commit }`, or `null` when none is recorded or it cannot be read. */
function readSeen(file) {
  try {
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(record?.seen) ? { list: record.seen, top: record.top, main: record.main, commit: record.commit } : null;
  } catch {
    return null;
  }
}

/** Records `list` as the session's last seen in the project at `top`, read at `commit` of `main`, by a temp file and
 * a rename, then prunes the records of sessions not written for thirty days. */
function writeSeen(file, { list, top, main, commit }, now) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temp, `${JSON.stringify({ top, main, commit, seen: list.map(reduce) }, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
  for (const name of fs.readdirSync(path.dirname(file))) {
    const other = path.join(path.dirname(file), name);
    try {
      if (other !== file && now - fs.statSync(other).mtimeMs > PRUNE_AFTER_MS) fs.rmSync(other, { force: true });
    } catch {
      // A record that went meanwhile is pruned already.
    }
  }
}

/** What the hook says for `input`: `{ event, context }`, `context` being `null` when there is nothing to tell, and
 * `fault` naming what could not be read. `git(args, top)` answers `{ status, stdout }`. */
export function reachHook(input, { home = os.homedir(), git = runGit, now = Date.now() } = {}) {
  const quiet = (fault) => ({ event: input?.hook_event_name ?? null, context: null, ...(fault ? { fault } : {}) });
  if (!isObject(input)) return quiet();
  const event = input.hook_event_name;
  const subagent = typeof input.agent_id === 'string' && input.agent_id !== '';
  if (event === 'SessionStart' && !RETOLD.has(input.source)) return quiet();
  if (!['UserPromptSubmit', 'SessionStart', 'SubagentStart'].includes(event)) return quiet();
  // A sub-agent's own session events carry the session's id: they must not spend the session's notice.
  if (event !== 'SubagentStart' && subagent) return quiet();
  const records = event === 'UserPromptSubmit' || event === 'SessionStart';
  if (records && !isSessionId(input.session_id)) return quiet();
  if (typeof input.cwd !== 'string' || input.cwd === '') return quiet();
  const top = gitTop(path.resolve(input.cwd));
  const list = top === null ? null : listOf(top);
  if (list === null) return quiet();

  const ask = (args) => git(args, top);
  const refs = ask(['for-each-ref', '--format=%(refname) %(objectname)', ...MAIN_REFS.map(([, full]) => full)]);
  const present = new Map(refs?.status === 0 ? refs.stdout.split('\n').map((line) => line.trim().split(' ')) : []);
  const [main, full] = MAIN_REFS.find(([, name]) => present.has(name)) ?? [];
  if (main === undefined) return quiet('no origin/HEAD, origin/main or main to compare with');
  const commit = present.get(full);
  const file = records ? seenPath(home, input.session_id) : null;
  // A record of another project, the session having moved, is no record here.
  const recorded = event === 'UserPromptSubmit' ? readSeen(file) : null;
  const seen = recorded?.top === top ? recorded : null;
  // Each git costs a few hundred milliseconds here: a turn after which main has not moved reads no list.
  if (seen !== null && seen.main === main && seen.commit === commit) return { event, context: null };
  const listAt = (rev) => {
    const shownText = ask(['show', `${rev}:${list.path}`]);
    if (shownText?.status === 0) return readListText(shownText.stdout, list.kind);
    // Only git saying the path is not in that tree means no list; a timeout or any other failure is a fault.
    const absent = shownText?.status === 128 && /does not exist|exists on disk, but not in/.test(shownText.stderr ?? '');
    return { fault: `${list.path} could not be read at ${rev}`, absent };
  };
  // Main holding no list declares no rule: a revert of the list is told as its rules removed.
  const read = listAt(main);
  if (read.fault && !read.absent) return quiet(read.fault);
  const onMain = read.fault ? { rules: [] } : read;

  let before = seen?.list ?? null;
  if (before === null) {
    const base = ask(['merge-base', 'HEAD', main]);
    if (base?.status !== 0) return quiet(`no merge base of HEAD and ${main}`);
    const atBase = listAt(base.stdout.trim());
    // A merge base that has no list yet owes nothing: the list the tree holds came with the branch.
    if (atBase.fault && !atBase.absent) return quiet(atBase.fault);
    before = atBase.fault ? onMain.rules : atBase.rules;
  }
  const context = rulesNotice(diffRules(before, onMain.rules), main);
  if (records) {
    try {
      writeSeen(file, { list: onMain.rules, top, main, commit }, now);
    } catch (err) {
      return { event, context, fault: `the last seen rules could not be recorded: ${err.message}` };
    }
  }
  return { event, context };
}

/** git in `top`, with a limit, so that a hook never waits long on it. */
function runGit(args, top) {
  const result = spawnSync('git', ['-C', top, ...args], { encoding: 'utf8', windowsHide: true, timeout: 1500 });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

/** `js-harness rules --hook`: reads the hook input, prints the notice in the hooks contract when there is one, and
 * exits 0 whatever happens, a fault going to standard error and never into the context. */
export async function rulesHookMain(argv, {
  env = process.env,
  // Every home of the harness honours JS_HARNESS_HOME, uninstall included; an empty one is no home.
  home = harnessHome({ env, homedir: os.homedir }),
  git = runGit,
  now = Date.now(),
  stdin = () => (process.stdin.isTTY ? '' : fs.readFileSync(0, 'utf8')),
  stdout = (text) => process.stdout.write(`${text}\n`),
  stderr = (text) => process.stderr.write(`${text}\n`),
} = {}) {
  if (argv.length > 0) {
    stderr(`js-harness rules --hook: unknown argument: ${argv[0]}\n${USAGE}`);
    return 2;
  }
  let input;
  try {
    const text = stdin();
    if (text.trim() === '') return 0;
    input = JSON.parse(text);
  } catch {
    return 0;
  }
  let result;
  try {
    result = reachHook(input, { home, git, now });
  } catch (err) {
    stderr(`js-harness rules --hook: ${err.message}`);
    return 0;
  }
  if (result.fault) stderr(`js-harness rules --hook: ${result.fault}`);
  if (result.context !== null) {
    stdout(JSON.stringify({ hookSpecificOutput: { hookEventName: result.event, additionalContext: result.context } }));
  }
  return 0;
}
