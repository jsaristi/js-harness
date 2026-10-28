// The pure part of the practice command (scripts/practice.mjs): where everything of the practice folder is,
// what environment every process it starts gets, when `setup` refuses, how the answer of git about a
// repository is read, which steps the journey has and how it is walked, how the user's real home is compared
// before and after a run, and the line a run leaves in the record. Facts in, values out. What that covers:
// - Nothing here reads the disk or the clock, or starts a process, and nothing prints; so its tests cost the
//   gate nothing.
// - Two defaults are taken from the process, and a caller can hand in both: `platform = process.platform`,
//   and `baseEnv = process.env` in `childEnv`. Nothing else reads the environment.
// - Given fully qualified paths, those a manifest records included, no result depends on the current
//   directory. `path.relative` (in `isInside`) and `path.resolve` (in `realHomeFiles`) complete a Windows
//   path that names no drive from the current directory; `setupRefusal` refuses such a root or home before
//   it compares them.
// The design is in odd/tasks/practice-project.md.
import path from 'node:path';
import crypto from 'node:crypto';
import { SANDBOX_ALLOWLIST, SANDBOX_SWITCHES } from '../evals/configs.mjs';

/** The path rules of `platform`. Every function below takes the platform as a parameter and goes through
 * this, so the Windows and the POSIX behaviour can both be tested on one machine. */
const pathFor = (platform) => (platform === 'win32' ? path.win32 : path.posix);

/** Whether the absolute path `absolute` says by itself where it is, by the rules of `platform`. On Windows
 * `\foo` and `/foo` are absolute and name no drive, and `\\server` names no share: Node completes them from
 * the current directory. A path there is fully qualified when it starts with a drive letter and a separator
 * (`D:\`, `d:/`) or is a network path (`\\server\share\...`). Off Windows every absolute path is. */
function fullyQualified(absolute, platform) {
  return platform !== 'win32' || /^[A-Za-z]:[\\/]/.test(absolute) || /^[\\/]{2}[^\\/]+[\\/]+[^\\/]+/.test(absolute);
}

// ---- the folder -------------------------------------------------------------------------------------------------------

/** Every path of the practice folder, from its root: the one folder whose deletion undoes everything.
 * `marker` says that this command made the folder, `project` is the practice project (its own git
 * repository), `prefix` is where the candidate is installed, `home` stands in for the user's home, `releases`
 * holds the packed candidate, `npmCache` is where npm keeps its cache and its logs (it would write them under
 * the user's home otherwise) and `record` gets one line per run. */
export function practiceLayout(root, platform = process.platform) {
  const p = pathFor(platform);
  return {
    root,
    marker: p.join(root, 'practice.json'),
    project: p.join(root, 'project'),
    prefix: p.join(root, 'prefix'),
    home: p.join(root, 'home'),
    releases: p.join(root, 'releases'),
    npmCache: p.join(root, 'npm-cache'),
    record: p.join(root, 'record.jsonl'),
    hostHome: p.join(root, 'host-home'),
  };
}

/** The folder where `npm install -g --prefix <prefix>` puts the `js-harness` command: the prefix itself on
 * Windows, its `bin` folder everywhere else. This is the folder that goes first on PATH. */
export function shimDir(prefix, platform = process.platform) {
  return platform === 'win32' ? prefix : pathFor(platform).join(prefix, 'bin');
}

/** The installed module's entry file, for running the candidate through `node` with no shell: npm puts the
 * modules directly under the prefix on Windows and under `lib` everywhere else. */
export function installedBin(prefix, platform = process.platform) {
  const p = pathFor(platform);
  const modules = platform === 'win32' ? p.join(prefix, 'node_modules') : p.join(prefix, 'lib', 'node_modules');
  return p.join(modules, 'js-harness', 'bin', 'js-harness.mjs');
}

// ---- the environment of every child process --------------------------------------------------------------------------

// The variables that bind a git command to one repository, as `git rev-parse --local-env-vars` lists them
// (the same list `bin/check.mjs` takes from a sensor). Git exports some to a hook and to an `--exec`.
const GIT_REPOSITORY_VARIABLES = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR',
];

// Where git stops looking for a repository on its way up. Set to a repository around the root, it makes git
// answer "not a git repository" inside that repository, and `setup` would read the place as a free one.
const GIT_DISCOVERY_CEILING = 'GIT_CEILING_DIRECTORIES';

/** The environment of every process the practice command starts, as a new object; `baseEnv` is left as it is.
 *
 * - The practice's command comes first on PATH, so the hook `init` writes (`exec js-harness check`) and every
 *   step find the candidate and never the copy on the user's PATH. Windows does not tell `Path` from `PATH`,
 *   and Node hands a child only the first of such names in sorted order: the result holds one PATH variable,
 *   with that value, under that name.
 * - `JS_HARNESS_HOME` is the practice's home, and every other `JS_HARNESS_*` variable of the caller is
 *   dropped: `JS_HARNESS_SOURCE`, `JS_HARNESS_PREFIX` and `JS_HARNESS_PM` would point the candidate at the
 *   machine's own install, and `JS_HARNESS_CHECK_INNER` would make its `check` skip the project's tests
 *   (`bin/check.mjs`), so a commit that must be refused would pass.
 * - `DO_NOT_TRACK` is `1`: `js-harness init` runs the real `codegraph init`, which queues telemetry and caches
 *   an update check under the user's real `~/.codegraph`; this variable switches both off, so the practice
 *   writes nothing outside its folder.
 * - The variables that bind git to one repository are dropped: started from a hook or an `--exec` of git, the
 *   `git init` and the commits of the practice would otherwise act on the repository the command was started
 *   from. So is the ceiling of git's search for a repository (`GIT_CEILING_DIRECTORIES`), which would hide
 *   from `setup` a repository around the root. Everything else git reads (the editor, the author, the ssh
 *   command) is kept.
 * - `HOME` and `USERPROFILE` are kept: git needs the user's identity to commit. The real home is protected by
 *   the before-and-after comparison below instead. */
export function childEnv(layout, baseEnv = process.env, platform = process.platform) {
  const windows = platform === 'win32';
  const named = (name, wanted) => (windows ? name.toUpperCase() === wanted : name === wanted);
  const ofHarness = (name) => (windows ? name.toUpperCase() : name).startsWith('JS_HARNESS_');
  const ofRepository = (name) => GIT_REPOSITORY_VARIABLES.includes(windows ? name.toUpperCase() : name) || named(name, GIT_DISCOVERY_CEILING);
  const replaced = (name) => named(name, 'PATH') || named(name, 'DO_NOT_TRACK') || ofHarness(name) || ofRepository(name);

  const pathName = Object.keys(baseEnv).filter((name) => named(name, 'PATH')).sort()[0];
  const searchPath = [shimDir(layout.prefix, platform), pathName === undefined ? '' : baseEnv[pathName]];
  return {
    ...Object.fromEntries(Object.entries(baseEnv).filter(([name]) => !replaced(name))),
    [pathName ?? 'PATH']: searchPath.filter(Boolean).join(pathFor(platform).delimiter),
    JS_HARNESS_HOME: layout.home,
    DO_NOT_TRACK: '1',
  };
}

// ---- the refusals of setup -------------------------------------------------------------------------------------------

/** Whether `child` is `parent` or lies under it, by the path rules of `platform`: on Windows the case of the
 * drive and of every segment is ignored and both separators count; on POSIX the case matters. `D:\foo-bar` is
 * not inside `D:\foo`. Both paths are fully qualified: a Windows path that names no drive would be completed
 * from the current directory. It compares spellings only: a link or a short name that leads into `parent` is
 * for the caller to resolve first. */
export function isInside(parent, child, platform = process.platform) {
  const p = pathFor(platform);
  const relative = p.relative(parent, child);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${p.sep}`) && !p.isAbsolute(relative));
}

/** Why `root`, as it was typed, cannot name the practice folder, in one sentence that names it, or `null`
 * when it can: it has to say by itself where it is. A path that is not absolute lies wherever the command
 * was started, and so does, on Windows, one that names no drive (`\foo`). `parseArgs` judges the argument
 * with this before the command resolves anything, and `setupRefusal` judges the root it is handed again. */
export function rootRefusal(root, platform = process.platform) {
  if (typeof root !== 'string' || !pathFor(platform).isAbsolute(root)) return `the root ${root} is not an absolute path`;
  if (!fullyQualified(root, platform)) {
    return `the root ${root} names no drive, so where it lies would depend on the folder the command was started from: on Windows a root starts with a drive letter, as D:\\, or is a network path`;
  }
  return null;
}

/** Why `setup` must not create the practice folder at `root`, in one sentence that names the path, or `null`
 * when it may. The command gathers the facts: `exists` (something is already at `root`), `gitRoot` (the top
 * level of the git repository `root` would lie in, or `null`) and `home` (the user's real home). `setup`
 * refuses a place that exists, because `run` deletes and rewrites inside the folder; one inside a repository,
 * because the practice project must be a repository of its own; and the home or anything inside it, because
 * the home is what the practice exists to leave alone. A root or a home that is not an absolute path cannot
 * be judged, and is refused; so is, on Windows, one that names no drive (`\foo`), because where it lies
 * would depend on the folder the command was started from.
 *
 * The repository is judged last, and it is the only refusal that needs git: `setupRefusalWithGit` calls this
 * once with `gitRoot: null`, before git is started, and again with the answer (`readGitRoot`) when the first
 * call found nothing to refuse. */
export function setupRefusal({ root, exists, gitRoot, home, platform = process.platform }) {
  const p = pathFor(platform);
  const ofRoot = rootRefusal(root, platform);
  if (ofRoot !== null) return ofRoot;
  if (exists) return `${root} already exists: setup only creates a new folder`;
  if (typeof home !== 'string' || !p.isAbsolute(home)) {
    return `the user's home is not known as an absolute path (${home}), so ${root} cannot be shown to lie outside it`;
  }
  if (!fullyQualified(home, platform)) return `the user's home ${home} names no drive, so ${root} cannot be shown to lie outside it`;
  if (isInside(home, root, platform)) return `${root} is inside the user's home ${home}, which the practice must never write to`;
  if (gitRoot) return `${root} is inside the git repository ${gitRoot}: the practice project needs a repository of its own`;
  return null;
}

/** What git says when the folder it was asked in lies in no repository, in the two wordings it has: no
 * repository up to the root of the disk, and none up to a mount point. `fatal: not a git repository: <path>`
 * is another thing, a link to a repository that is not there, and is not matched. */
const NO_REPOSITORY = /not a git repository \(or any /;

/** Reads what `git rev-parse --show-toplevel` answered (`status`, `stdout` and `stderr` of the child, asked
 * in English) about the folder the practice would be created in:
 *
 * - `{ gitRoot: '<path>' }` when it exited 0 and printed the top level of a repository;
 * - `{ gitRoot: null }` only when git said that there is no repository there;
 * - `{ refusal }` for anything else, in one sentence of one line with what git printed: a repository git
 *   refuses to read ("detected dubious ownership"), the inside of a `.git` folder, a child that was ended,
 *   an exit 0 that names no folder. Git exits non-zero for all of these too, so reading every failure as
 *   "no repository" would let `setup` create the practice inside one. */
export function readGitRoot({ status, stdout, stderr }) {
  const top = typeof stdout === 'string' ? stdout.trim() : '';
  const said = typeof stderr === 'string' ? stderr.trim().replace(/\s+/g, ' ') : '';
  const failed = Number.isInteger(status) && status !== 0;
  if (status === 0 && top !== '') return { gitRoot: top };
  if (failed && NO_REPOSITORY.test(said)) return { gitRoot: null };
  const how = status === 0 ? 'it exited 0 and named no folder' : failed ? `it exited ${status}` : 'it did not exit by itself';
  return { refusal: `git did not say whether the practice folder would lie inside a repository (${how}): ${said || 'it printed nothing'}` };
}

/** Why `setup` must not create the practice folder, or `null`, with git asked only when it has to be.
 * `facts` is what `setupRefusal` takes, less `gitRoot`; `askGit` starts `git rev-parse --show-toplevel` and
 * returns what the child answered, as `readGitRoot` reads it. What needs no git is judged first, so a root
 * that is an existing file is refused as existing and git is never asked in a place it could not be asked
 * in. Then git's answer either refuses by itself, when it says neither "a repository" nor "none", or is the
 * last fact `setupRefusal` needs. */
export function setupRefusalWithGit(facts, askGit) {
  const withoutGit = setupRefusal({ ...facts, gitRoot: null });
  if (withoutGit !== null) return withoutGit;
  const answer = readGitRoot(askGit());
  return answer.refusal ?? setupRefusal({ ...facts, gitRoot: answer.gitRoot });
}

// ---- the marker ------------------------------------------------------------------------------------------------------

/** What `madeBy` reads in a marker this command wrote. */
const MARKER_SIGNATURE = 'js-harness practice';

/** The text of `practice.json`: that this command made the folder, when (`createdAt`, a date as text) and
 * from which commit (`candidate`: `{ branch, commit, dirty }`). */
export function markerContent({ createdAt, candidate }) {
  return `${JSON.stringify({ madeBy: MARKER_SIGNATURE, createdAt, candidate }, null, 2)}\n`;
}

/** Whether `markerText` (the content of a folder's `practice.json`, or `undefined` when there is none) is a
 * marker this command wrote. `run` refuses a folder it does not own, because it deletes and rewrites inside
 * it; a missing marker, text that is not JSON and JSON of any other shape are all not ours. */
export function ownsFolder(markerText) {
  if (typeof markerText !== 'string') return false;
  try {
    const marker = JSON.parse(markerText);
    return marker !== null && typeof marker === 'object' && !Array.isArray(marker) && marker.madeBy === MARKER_SIGNATURE;
  } catch {
    return false;
  }
}

// ---- the real home, before and after ---------------------------------------------------------------------------------

// What `install` writes under a home (`bin/lib/manifest.mjs`: `components` and `entryComponents`): three skills
// for each of two hosts, two entries in a file of each host, and the pause entry in Claude Code's (`HARNESS_HOOKS` below).
const SKILLS = ['js-harness', 'js-harness-orchestrator', 'js-harness-protocols'];
const HOSTS = ['.claude', '.codex'];
// The arrays of the manifest whose records name a file by `path`: what `install` wrote, the files it grafted
// an entry onto, and what was written only when asked (the login launcher, which lies outside the home).
const RECORDED = ['files', 'entries', 'optional'];

/** The `path` of every record of the manifest `manifestText`; none when the text is missing, is not JSON or
 * has another shape. A manifest that cannot be read is no reason to stop: the fixed list still stands. */
function recordedPaths(manifestText) {
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    return [];
  }
  return RECORDED.flatMap((key) => (Array.isArray(manifest?.[key]) ? manifest[key] : []))
    .map((record) => record?.path)
    .filter((recorded) => typeof recorded === 'string' && recorded !== '');
}

/** The files the harness owns in the user's REAL home `home`, as absolute paths without duplicates: the
 * manifest, the `SKILL.md` of the three skills for both hosts, the two files that hold a `SessionStart` entry,
 * and every file the real manifest (`manifestText`, the content of `<home>/.js-harness/manifest.json`, or
 * `undefined`) records. The manifest records absolute paths; a relative one is taken from `home`. On Windows
 * two paths that differ only in case are one file.
 *
 * The practice never writes to this home, and the run proves it: these files are hashed before the first
 * step and after the last, and any difference fails the run. The doctor cache (`.js-harness/doctor.json`) is
 * left out on purpose: every session start of the user's rewrites it, so it would fail a run that did
 * nothing wrong. So is the gate log (`.js-harness/gate-log`): every gate of the user's own sessions appends
 * to it. The gates of the run itself write the one of the practice home (`gateLogFolder`). */
export function realHomeFiles(home, manifestText, platform = process.platform) {
  const p = pathFor(platform);
  const fixed = [
    p.join(home, '.js-harness', 'manifest.json'),
    ...HOSTS.flatMap((host) => SKILLS.map((skill) => p.join(home, host, 'skills', skill, 'SKILL.md'))),
    p.join(home, '.claude', 'settings.json'),
    p.join(home, '.codex', 'hooks.json'),
  ];
  const files = new Map();
  for (const file of [...fixed, ...recordedPaths(manifestText).map((recorded) => p.resolve(home, recorded))]) {
    const key = platform === 'win32' ? file.toLowerCase() : file;
    if (!files.has(key)) files.set(key, file);
  }
  return [...files.values()];
}

/** The SHA-256 of a file's content (a string or the bytes) in hex, or `null` for a file that is not there
 * (`null` or `undefined`): the value a snapshot holds for one path. */
export function contentHash(content) {
  if (content === null || content === undefined) return null;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** The differences between two snapshots of the same files, each `{ [absolutePath]: hash or null }` with
 * `null` for a file that does not exist: a list of `{ path, change }` where `change` is `changed`,
 * `appeared` or `disappeared`, in the order of `before` and then of what only `after` names. An empty list
 * means the home is as it was. A path only one snapshot names counts as absent from the other. */
export function compareSnapshots(before, after) {
  const differences = [];
  for (const file of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const was = before[file] ?? null;
    const is = after[file] ?? null;
    if (was === is) continue;
    differences.push({ path: file, change: was === null ? 'appeared' : is === null ? 'disappeared' : 'changed' });
  }
  return differences;
}

// ---- the hook entries of a host file ---------------------------------------------------------------------------------

/** The command of the pause hook, as `bin/lib/manifest.mjs` spells it (`PAUSE_HOOK_COMMAND`): a test holds the two
 * spellings together, as the gate log's folder is held. */
const PAUSE_HOOK_COMMAND = 'js-harness resume --pause || exit 0';

/** The command of the guard hook, as `bin/lib/manifest.mjs` spells it (`GUARD_HOOK_COMMAND`); the same test holds the two together. */
const GUARD_HOOK_COMMAND = 'js-harness guard --hook || exit 0';

/** The command of the permit relay, as `bin/lib/manifest.mjs` spells it (`PERMIT_HOOK_COMMAND`); the same test holds the two together. */
const PERMIT_HOOK_COMMAND = 'js-harness permit --hook || exit 0';

/** The command of the share check, as `bin/lib/manifest.mjs` spells it (`SHARE_HOOK_COMMAND`); the same test holds the two together. */
const SHARE_HOOK_COMMAND = 'js-harness guard --stop || exit 0';

/** The command of the reply check, as `bin/lib/manifest.mjs` spells it (`REPLY_HOOK_COMMAND`); the same test holds the two together. */
const REPLY_HOOK_COMMAND = 'js-harness reply --hook || exit 0';

/** The command of the memory backup's hook, as `bin/lib/manifest.mjs` spells it (`BACKUP_HOOK_COMMAND`); the same test holds the two together. */
const BACKUP_HOOK_COMMAND = 'js-harness backup --hook || exit 0';

/** The command of the memory fallback's notice, as `bin/lib/manifest.mjs` spells it (`FALLBACK_HOOK_COMMAND`); the same test holds the two together. */
const FALLBACK_HOOK_COMMAND = 'js-harness backup --session-start || exit 0';

/** The command of the rules' turn-start hook, as `bin/lib/manifest.mjs` spells it (`RULES_HOOK_COMMAND`); the same test holds the two together. */
const RULES_HOOK_COMMAND = 'js-harness rules --hook || exit 0';

/** The matcher of the guard hook, as `bin/lib/manifest.mjs` spells it: anchored, so that each tool is a whole name. The same test holds the two together. */
const GUARD_HOOK_MATCHER = '^(Agent|SendMessage|mcp__ccd_session_mgmt__send_message|Bash|Read|Write|Edit|MultiEdit|NotebookEdit|Grep|mcp__scheduled-tasks__create_scheduled_task|mcp__scheduled-tasks__update_scheduled_task|mcp__scheduled-tasks__run_scheduled_task|RemoteTrigger|mcp__ccd_session__start_session|mcp__terminal__run_in_terminal)$';

/** The entries `install` grafts on the hooks file of each host, in the order it writes them, each as the event
 * it hangs from, its matcher (none for the pause entry) and its command, and the hosts that get it: the doctor's
 * at the start of a session and the resume hook's after a compaction or a clear, for both hosts; the pause entry after a
 * tool call, for Claude Code only, since a Codex session has no transcript the pause is read from, and the same command
 * after a WebFetch that failed, for Claude Code only, since WebFetch is its tool; the guard's before a tool call and the
 * share check's at a stop, for Claude Code only; and the reply check's at a stop, for both hosts, since it reads only the
 * reply's text. The test holds
 * this list to what `bin/lib/manifest.mjs` declares (`entryComponents`), so a journey cannot go on passing against
 * an install that changed. */
export const HARNESS_HOOKS = Object.freeze([
  Object.freeze({ event: 'SessionStart', matcher: 'startup|resume', command: 'js-harness doctor --hook', hosts: Object.freeze(['claude', 'codex']) }),
  Object.freeze({ event: 'SessionStart', matcher: 'compact|clear|startup', command: 'js-harness resume --hook', hosts: Object.freeze(['claude', 'codex']) }),
  Object.freeze({ event: 'PostToolUse', command: PAUSE_HOOK_COMMAND, hosts: Object.freeze(['claude']) }),
  Object.freeze({ event: 'PostToolUseFailure', matcher: 'WebFetch', command: PAUSE_HOOK_COMMAND, hosts: Object.freeze(['claude']) }),
  Object.freeze({ event: 'PreToolUse', matcher: GUARD_HOOK_MATCHER, command: GUARD_HOOK_COMMAND, hosts: Object.freeze(['claude']) }),
  Object.freeze({ event: 'PermissionRequest', command: PERMIT_HOOK_COMMAND, hosts: Object.freeze(['claude']) }),
  Object.freeze({ event: 'Stop', command: SHARE_HOOK_COMMAND, hosts: Object.freeze(['claude']) }),
  Object.freeze({ event: 'UserPromptSubmit', command: RULES_HOOK_COMMAND, hosts: Object.freeze(['claude']) }),
  Object.freeze({ event: 'SessionStart', matcher: 'compact|clear|resume', command: RULES_HOOK_COMMAND, hosts: Object.freeze(['claude']) }),
  Object.freeze({ event: 'SubagentStart', command: RULES_HOOK_COMMAND, hosts: Object.freeze(['claude']) }),
  Object.freeze({ event: 'Stop', command: REPLY_HOOK_COMMAND, hosts: Object.freeze(['claude', 'codex']) }),
  Object.freeze({ event: 'Stop', command: BACKUP_HOOK_COMMAND, hosts: Object.freeze(['claude', 'codex']) }),
  Object.freeze({ event: 'SessionStart', matcher: 'startup|resume|clear|compact', command: FALLBACK_HOOK_COMMAND, hosts: Object.freeze(['claude', 'codex']) }),
]);

/** The entries of `HARNESS_HOOKS` that `install` grafts on the hooks file of `host` (`claude` or `codex`), in order. */
export function hooksOfHost(host) {
  return HARNESS_HOOKS.filter((hook) => hook.hosts.includes(host));
}

/** A hook as the messages of this library name it: its command, its event and its matcher, or that it has none. */
export function hookLabel(hook) {
  return `"${hook.command}" (${hook.event}, ${hook.matcher === undefined ? 'no matcher' : `matcher ${hook.matcher}`})`;
}

/** The commands of the hook entry `entry` as one string (`a && b` for more than one), or `null` when it has
 * none or is no entry. */
function entryCommand(entry) {
  const commands = Array.isArray(entry?.hooks) ? entry.hooks.map((hook) => hook?.command).filter((command) => typeof command === 'string') : [];
  return commands.length === 0 ? null : commands.join(' && ');
}

/** One entry of a hooks list as the messages of this library name it: its command, its matcher or that it has none. */
function entryShown(entry) {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return 'not an entry';
  const command = entryCommand(entry);
  return `${command === null ? 'no command' : `"${command}"`} (${typeof entry.matcher === 'string' ? `matcher ${entry.matcher}` : 'no matcher'})`;
}

/** What is wrong with the hook entries of a host file after `install`, or `null` when nothing is. `text` is
 * the content of the file (`.claude/settings.json`, `.codex/hooks.json`), `seededCommand` the command of the
 * one entry that was there before, the user's, and `host` (`claude` or `codex`) the host whose file it is, which
 * decides what `install` wrote there. Nothing is wrong when `hooks.SessionStart` holds that entry first and
 * untouched in what it runs, and then each of the host's `SessionStart` entries of `HARNESS_HOOKS` once, in
 * order, with its matcher and its command: an entry missing, one written twice by a second install, and the right
 * command under another matcher are each a problem. `hooks.PostToolUse` is checked after that, by
 * `postToolUseProblem`. The message says what was expected and every entry found, so a failed step shows the
 * file without opening it. */
export function hostHooksProblem(text, seededCommand, host) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return 'the file is not JSON';
  }
  const entries = data?.hooks?.SessionStart;
  if (!Array.isArray(entries)) return 'the file holds no list at hooks.SessionStart';
  const ours = hooksOfHost(host).filter((hook) => hook.event === 'SessionStart');
  const asExpected =
    entries.length === ours.length + 1 &&
    entryCommand(entries[0]) === seededCommand &&
    ours.every((hook, index) => entryCommand(entries[index + 1]) === hook.command && entries[index + 1].matcher === hook.matcher);
  if (!asExpected) {
    const expected = [`the seeded entry "${seededCommand}"`, ...ours.map((hook) => `"${hook.command}" (matcher ${hook.matcher})`)].join(', then ');
    return `expected ${expected}; found: ${entries.length === 0 ? 'no entry' : entries.map(entryShown).join(' | ')}`;
  }
  return postToolUseProblem(data, host) ?? tailProblem(data, host, 'UserPromptSubmit') ?? tailProblem(data, host, 'SubagentStart');
}

/** What is wrong with `hooks.PostToolUse` of a host file, or `null` when nothing is. Claude Code holds the pause
 * entry once, with no matcher, at the end of the list: `install` appends it, so a user's own entry before it stays
 * first and untouched. Codex holds no entry of the harness there, so one found in its file is a problem. */
function postToolUseProblem(data, host) {
  return tailProblem(data, host, 'PostToolUse');
}

/** What is wrong with the list `hooks.<event>` of a host file, held as `postToolUseProblem` holds `PostToolUse`: the
 * harness's entries of that event once each at its end, and none where the host gets none (the rules' turn-start
 * entries are Claude Code's alone). */
function tailProblem(data, host, event) {
  const list = data?.hooks?.[event];
  const ours = hooksOfHost(host).filter((hook) => hook.event === event);
  if (!Array.isArray(list)) return ours.length === 0 ? null : `the file holds no list at hooks.${event}`;
  const harnessCommands = HARNESS_HOOKS.filter((hook) => hook.event === event).map((hook) => hook.command);
  const harnessFound = list.filter((entry) => harnessCommands.includes(entryCommand(entry)));
  const found = list.length === 0 ? 'no entry' : list.map(entryShown).join(' | ');
  if (ours.length === 0) return harnessFound.length === 0 ? null : `expected no entry of the harness in hooks.${event} of ${host}; found: ${found}`;
  const tail = list.slice(-ours.length);
  const asExpected =
    harnessFound.length === ours.length &&
    ours.every((hook, index) => entryCommand(tail[index]) === hook.command && tail[index]?.matcher === hook.matcher);
  if (asExpected) return null;
  const expected = ours.map((hook) => `"${hook.command}" (${hook.matcher === undefined ? 'no matcher' : `matcher ${hook.matcher}`})`).join(', then ');
  return `expected ${expected} once, at the end of hooks.${event}; found: ${found}`;
}

/** What is wrong with a host file after `uninstall`, or `null` when it is the file as `setup` seeded it (`seededText`, the
 * content the journey wrote), byte for byte. `install` takes back every list it made when `uninstall` removes its entry
 * (`createdContainers` in the manifest), so nothing but the seeded bytes is right. An empty `hooks.SessionStart` or
 * `hooks.PostToolUse` list that the seeded file does not have is named, since it is the leftover this check exists to catch. */
export function uninstalledHostProblem(text, seededText) {
  if (typeof text !== 'string') return 'the file is not there';
  if (text === seededText) return null;
  const leftover = leftoverList(text, seededText);
  if (leftover !== null) {
    return `hooks.${leftover} is left as an empty list, which install made and uninstall must remove; found:\n${text}`;
  }
  return `expected the file as setup seeded it, byte for byte; found:\n${text}`;
}

/** The name of an empty `hooks` list of the harness (`SessionStart`, `PostToolUse` or `PostToolUseFailure`) that `text` holds and the seeded file
 * does not, or `null`. A text that is not JSON has none. */
function leftoverList(text, seededText) {
  let data;
  let seeded;
  try {
    data = JSON.parse(text);
    seeded = JSON.parse(seededText);
  } catch {
    return null;
  }
  return ['SessionStart', 'PostToolUse', 'PostToolUseFailure', 'UserPromptSubmit', 'SubagentStart'].find((key) => Array.isArray(data?.hooks?.[key]) && data.hooks[key].length === 0 && seeded?.hooks?.[key] === undefined) ?? null;
}

// ---- the gate log of the practice home -------------------------------------------------------------------------------

/** Where the gates of the home `home` keep their log (`gateLogDir` of `bin/lib/gate-log.mjs`). It is spelled
 * here, as the manifest's path is above, because the practice looks at the candidate from outside and
 * imports nothing of it; a test holds the two spellings together.
 *
 * The commits of the journey go through the hook, and the `check` it runs is a gate whose home is
 * `JS_HARNESS_HOME` (`childEnv`): so they write this folder in the practice home, and never the user's.
 * Nothing but `uninstall --global` removes it, which is what the step `global-uninstall` looks at. */
export function gateLogFolder(home, platform = process.platform) {
  return pathFor(platform).join(home, '.js-harness', 'gate-log');
}

// ---- the journey -----------------------------------------------------------------------------------------------------

/** The journey of `run`, in order: the steps of the feature document ("The journey"), with `pause-hook` and `channel`
 * (odd/tasks/session-channel.md, T10), the two the session channel adds. An `id` goes into
 * the record, so it never changes once a line was written with it; a feature that changes what a project
 * receives adds its own step here, with its test. */
export const JOURNEY = Object.freeze([
  { id: 'real-home-before', title: 'hash what the harness owns in the real home' },
  { id: 'pack-install', title: 'pack the candidate and install it into the practice prefix' },
  { id: 'install', title: 'js-harness install writes the manifest, the skills and the hook entries into the practice home' },
  { id: 'project-adopt', title: 'the project receives the harness: init the first time, status then sync afterwards' },
  { id: 'commit-passes', title: 'a commit that should pass goes through the hook and exists afterwards' },
  { id: 'commit-refused', title: 'a commit that breaks the test of the project is refused, and the file is restored' },
  { id: 'project-rules', title: "the project's own rules are listed and checked, and a commit that drops one is refused" },
  { id: 'project-uninstall', title: 'uninstall removes what init wrote and nothing the project owns; init again' },
  { id: 'template-lines', title: "the AGENTS.md init wrote is the candidate's template, with the lines that hold in any project, in at most half the budget" },
  { id: 'global-uninstall', title: 'uninstall --global leaves the practice home as it was; install again' },
  { id: 'pause-hook', title: 'the context pause hook prints its notice once in the project, and nothing outside it' },
  { id: 'channel', title: 'a notice recorded in the installed project is read back on its board, and nothing reaches the real home' },
  { id: 'opening-tools', title: 'the guard lets the scheduled-task and cloud tools pass in the project, and refuses them where the rule is declared, naming start_session' },
  { id: 'reply-hook', title: 'the reply check turns back a reply with no state where harness.json turns it on, lets a closed reply stop, and turns nothing back outside any project' },
  { id: 'host-loads', title: 'a real Claude Code session in the project loads the skills and AGENTS.md, runs the three hook entries, and leaves nothing in the real home' },
  { id: 'real-home-after', title: 'the real home is unchanged' },
  { id: 'record', title: 'one line is appended to record.jsonl' },
].map((step) => Object.freeze(step)));

/** What is wrong after `uninstall` and a second `init` of the practice project, or `null`: no tracked file may differ
 * from the commit, but for an `AGENTS.md` that is exactly the candidate's template (`template`). `init` writes the
 * template of the copy that runs it, and the project committed the one of an earlier candidate, so a candidate that
 * changes the template shows it here once; the next run's `commit-passes` commits it. */
export function secondInitProblem(porcelainText, agentsText, template, claudeText, claudeTemplate) {
  const lines = porcelainText.split('\n').filter(Boolean); // AGENTS.md, and CLAUDE.md since the split (odd/tasks/f8-s3-split.md, S3)
  const templated = (line) => (line === ' M AGENTS.md' && agentsText === template) || (line === ' M CLAUDE.md' && claudeText !== undefined && claudeText === claudeTemplate);
  return lines.every(templated) ? null : `tracked files differ after the second js-harness init:\n${lines.join('\n')}`;
}

/** The sorted `git status --porcelain` lines the practice project should show after `uninstall`, from the lines it
 * showed before (`before`) and the text of the manifest `init` wrote (`manifestText`, read before uninstall removes
 * it): every untracked path the manifest records as written (`files`, `dirs`) is gone, and so is `.codegraph/`, and a
 * settings file init created (`settings`, `createdFile`) with its folder when init created that too (`createdDir`);
 * `harness.json` and `AGENTS.md`, which `init` wrote and the step `commit-passes` committed, show as deleted. The list
 * is read from the manifest, so a file `init` begins to write is expected to go without this step being told. A
 * manifest that cannot be read takes nothing away but `.codegraph/`, and the step then names what differs. */
export function uninstallExpected(before, manifestText) {
  let manifest = {};
  try {
    manifest = JSON.parse(manifestText ?? '') ?? {};
  } catch {
    manifest = {};
  }
  const recorded = new Set(['.codegraph']);
  for (const entry of [...(Array.isArray(manifest.files) ? manifest.files : []), ...(Array.isArray(manifest.dirs) ? manifest.dirs : [])]) {
    if (typeof entry?.path === 'string' && !entry.gitDir) recorded.add(entry.path.replace(/\/+$/, ''));
  }
  // A settings file init created is removed with its folder when init created that too (B1).
  for (const entry of Array.isArray(manifest.settings) ? manifest.settings : []) {
    if (typeof entry?.path !== 'string' || entry.createdFile !== true) continue;
    recorded.add(entry.path);
    if (entry.createdDir === true) recorded.add(entry.path.replace(/\/[^/]*$/, ''));
  }
  const gone = (line) => line.startsWith('?? ') && recorded.has(line.slice(3).replace(/\/+$/, ''));
  return [...before.filter((line) => !gone(line)), ' D AGENTS.md', ...(manifest.files?.some?.((entry) => entry?.path === 'CLAUDE.md') ? [' D CLAUDE.md'] : []), ' D harness.json'].sort(); // CLAUDE.md since the split, S3
}

/** The sections `agentsTemplate` gained with the lines that hold in any project (odd/tasks/rule-hierarchy.md, T9), whose
 * wording is the owner's yes: the step `template-lines` looks for each in the AGENTS.md the installed `init` wrote. */
export const TEMPLATE_SECTIONS = Object.freeze(['What good looks like', 'Working with the owner']);

/** What is wrong with the AGENTS.md the installed `init` wrote, or `null` (odd/tasks/rule-hierarchy.md, T12).
 * `agentsText` is the file, or nothing; `template` is `agentsTemplate` of the candidate's source, so the two match only
 * when the copy installed is the candidate. The file must hold each of `TEMPLATE_SECTIONS` as a `## ` heading and the
 * line of the five states (read with the wrapping undone), and `tokens`, its estimated size, must be at most half of
 * `budget` (agents-budget), so that a project keeps the other half for its own lines. */
export function templateLinesProblem({ agentsText, template, tokens, budget }) {
  if (agentsText === undefined) return 'the project has no AGENTS.md after js-harness init';
  if (agentsText !== template) return "the AGENTS.md js-harness init wrote is not this candidate's template (agentsTemplate of bin/lib/project.mjs), so the copy installed is not the candidate";
  const headings = agentsText.split(/\r?\n/);
  for (const section of TEMPLATE_SECTIONS) {
    if (!headings.includes(`## ${section}`)) return `the template js-harness init wrote has no section "${section}"`;
  }
  if (!agentsText.replace(/\s+/g, ' ').includes('A reply ends in one of the five states')) return 'the template js-harness init wrote does not say that a reply ends with one of five states';
  const half = budget / 2;
  if (tokens > half) return `the template js-harness init wrote is ${tokens} estimated tokens, over ${half}, half of agents-budget: a project keeps less than half for its own lines`;
  return null;
}

/** The one step that starts a host session, and so spends a model: `run --no-host` leaves it out. */
export const HOST_STEP = 'host-loads';

/** The environment of the host session of `host-loads` (odd/tasks/practice-project.md, "T5: the step host-loads"):
 * an allowlist, never `childEnv`, because the session that starts a run carries what must not reach a host it
 * starts (`CLAUDE_CODE_CHILD_SESSION` turns its transcript off, the messaging socket and token of a live desktop
 * session, `CLAUDE_PLUGIN_DATA`, another login). Only the evals' allowlisted names are inherited; their switches
 * are set (no updater, telemetry or claude.ai connectors); the host's config is the practice home's `.claude`,
 * where `install` wrote the skills and the hook entries; the harness's home is the practice home; every other
 * home, temporary and cache folder is the scratch `hostHome`, emptied by the step; the candidate comes first on
 * PATH; and the login is `token`, set here only. */
export function hostEnv(layout, baseEnv, token, platform = process.platform) {
  const p = pathFor(platform);
  const windows = platform === 'win32';
  const fold = (name) => (windows ? name.toUpperCase() : name);
  const allowed = new Set(SANDBOX_ALLOWLIST.filter((name) => name !== 'CLAUDE_CODE_OAUTH_TOKEN').map(fold));
  const inherited = Object.fromEntries(Object.entries(baseEnv).filter(([name, value]) => allowed.has(fold(name)) && typeof value === 'string'));
  const scratch = layout.hostHome;
  const temp = p.join(scratch, 'tmp');
  const drive = windows ? { HOMEDRIVE: scratch.slice(0, 2), HOMEPATH: scratch.slice(2) } : {};
  const pathName = Object.keys(inherited).filter((name) => fold(name) === 'PATH').sort()[0] ?? 'PATH';
  return {
    ...inherited,
    [pathName]: [shimDir(layout.prefix, platform), inherited[pathName]].filter(Boolean).join(p.delimiter),
    USERPROFILE: scratch,
    HOME: scratch,
    ...drive,
    APPDATA: p.join(scratch, 'AppData', 'Roaming'),
    LOCALAPPDATA: p.join(scratch, 'AppData', 'Local'),
    TEMP: temp,
    TMP: temp,
    TMPDIR: temp,
    XDG_CONFIG_HOME: p.join(scratch, '.config'),
    XDG_DATA_HOME: p.join(scratch, '.local', 'share'),
    XDG_STATE_HOME: p.join(scratch, '.local', 'state'),
    XDG_CACHE_HOME: p.join(scratch, '.cache'),
    CLAUDE_CONFIG_DIR: p.join(layout.home, '.claude'),
    JS_HARNESS_HOME: layout.home,
    ...SANDBOX_SWITCHES,
    CLAUDE_CODE_OAUTH_TOKEN: token,
  };
}

// The tools that read files: none may reach the first call, so the word of the run can only come from what loaded.
const FILE_TOOLS = ['Read', 'Grep', 'Glob', 'Bash', 'PowerShell', 'NotebookRead', 'Task', 'Agent'];
// The first words `js-harness resume --hook` prints after a compaction (bin/resume.mjs).
const RESUME_WORDS = 'js-harness resume:';
// What the host entry setup seeds before the harness is installed prints (`echo unrelated-claude-hook`, scripts/e2e.mjs).
const SEEDED_HOOK_OUTPUT = 'unrelated-claude-hook';

/** The parts of a host's `--output-format stream-json --verbose --include-hook-events` output the step reads: the
 * `system/init` event, every `system/hook_response` as `{ name, exitCode, outcome, stdout }`, and the last result.
 * A line that is not JSON is passed over. The names were read from Claude Code 2.1.296 (scripts/fixtures). */
export function readHostStream(text) {
  const events = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    try {
      const event = JSON.parse(line);
      if (event !== null && typeof event === 'object') events.push(event);
    } catch {
      // Not an event of the stream.
    }
  }
  const init = events.find((event) => event.type === 'system' && event.subtype === 'init') ?? null;
  const hooks = events
    .filter((event) => event.type === 'system' && event.subtype === 'hook_response')
    .map((event) => ({ name: event.hook_name, exitCode: event.exit_code, outcome: event.outcome, stdout: String(event.stdout ?? '') }));
  const result = events.filter((event) => event.type === 'result').at(-1) ?? null;
  return { init, hooks, result };
}

/** What is wrong with one call of the host session, one sentence each; none when it proves what it is for.
 * `load` (no tools, one turn): both skills listed, no file tool, every startup hook a success, the turn's hook ran
 * (the rules hook, `UserPromptSubmit`), and the answer holds `word`, which only the practice's AGENTS.md holds.
 * `skill`: the pause entry ran after the skill and succeeded, and the answer quotes the skill. `compact`: the compact
 * entry printed the words of `js-harness resume`, and a second compact entry, the rules hook, succeeded. `subagent`: a
 * sub-agent's start hook ran and succeeded, the rules hook's third event (odd/tasks/rule-hierarchy.md, T16f). The host
 * names a hook of an event with a matcher `<event>:<what matched>`, and one without a matcher by its event alone. */
export function hostCallProblems(kind, { init, hooks, result }, { word } = {}) {
  const problems = [];
  const succeeded = (hook) => hook.exitCode === 0 && hook.outcome === 'success';
  const named = (name) => hooks.filter((hook) => hook.name === name);
  const ofEvent = (event) => hooks.filter((hook) => hook.name === event || String(hook.name).startsWith(`${event}:`));
  const ranAndSucceeded = (event, found) => {
    if (found.length === 0) problems.push(`no ${event} hook ran`);
    for (const hook of found.filter((item) => !succeeded(item))) problems.push(`a ${event} hook did not succeed (exit ${hook.exitCode}, ${hook.outcome})`);
  };
  if (kind === 'load') {
    if (init === null) problems.push('the stream has no init event');
    else {
      for (const skill of ['js-harness', 'js-harness-orchestrator']) {
        if (!(init.skills ?? []).includes(skill)) problems.push(`the session did not list the skill ${skill}`);
      }
      const readers = (init.tools ?? []).filter((tool) => FILE_TOOLS.includes(tool));
      if (readers.length > 0) problems.push(`the session had a tool that reads files: ${readers.join(', ')}`);
    }
    const started = named('SessionStart:startup');
    if (started.length === 0) problems.push('no SessionStart:startup hook ran');
    for (const hook of started.filter((item) => !succeeded(item))) problems.push(`a SessionStart:startup hook did not succeed (exit ${hook.exitCode}, ${hook.outcome})`);
    ranAndSucceeded('UserPromptSubmit', ofEvent('UserPromptSubmit'));
  }
  if (kind === 'subagent') ranAndSucceeded('SubagentStart', ofEvent('SubagentStart'));
  if (kind === 'skill') {
    const after = named('PostToolUse:Skill');
    if (after.length === 0) problems.push('no PostToolUse:Skill hook ran');
    for (const hook of after.filter((item) => !succeeded(item))) problems.push(`a PostToolUse:Skill hook did not succeed (exit ${hook.exitCode}, ${hook.outcome})`);
  }
  if (kind === 'compact') {
    const compacted = named('SessionStart:compact').filter(succeeded);
    if (!compacted.some((hook) => hook.stdout.startsWith(RESUME_WORDS))) problems.push('no SessionStart:compact hook printed the words of js-harness resume');
    // The one left is the rules hook: the entry setup seeds (`SEEDED_HOOK_OUTPUT`) runs at a compaction too.
    if (!compacted.some((hook) => !hook.stdout.startsWith(RESUME_WORDS) && hook.stdout.trim() !== SEEDED_HOOK_OUTPUT)) {
      problems.push('no SessionStart:compact hook ran beside the one of js-harness resume, so the rules hook did not');
    }
  }
  if (result === null) {
    problems.push('the stream has no result');
    return problems;
  }
  if (result.subtype !== 'success' || result.is_error === true) problems.push(`the result is not a success (${result.subtype})`);
  const answer = String(result.result ?? '');
  if (kind === 'load') {
    if (result.num_turns !== 1) problems.push(`the answer took ${result.num_turns} turns, so it could have read the file instead of what was loaded`);
    if (!answer.toLowerCase().includes(String(word).toLowerCase())) problems.push(`the answer does not hold the word of the run (${word}), so AGENTS.md was not loaded`);
  }
  if (kind === 'skill' && !answer.includes('js-harness check --push')) {
    problems.push('the answer does not quote the js-harness skill (its line js-harness check --push)');
  }
  return problems;
}

/** What the calls cost, summed from their results, with the host's version and the model the results name: the
 * `host` of the record line. */
export function hostCost(streams) {
  const results = streams.map((stream) => stream.result).filter((result) => result !== null);
  const sum = (read) => results.reduce((total, result) => total + (Number(read(result)) || 0), 0);
  const first = streams.find((stream) => stream.init !== null)?.init;
  return {
    version: first?.claude_code_version ?? null,
    model: Object.keys(results.find((result) => result.modelUsage)?.modelUsage ?? {})[0] ?? first?.model ?? null,
    inputTokens: sum((result) => result.usage?.input_tokens),
    outputTokens: sum((result) => result.usage?.output_tokens),
    cacheTokens: sum((result) => (result.usage?.cache_creation_input_tokens ?? 0) + (result.usage?.cache_read_input_tokens ?? 0)),
    costUsd: sum((result) => result.total_cost_usd),
    durationMs: sum((result) => result.duration_ms),
  };
}

/** `text` with every occurrence of `token` replaced by `<token>`, so that no detail, record or error the step
 * hands on can carry the login. A missing text is empty; with no token the text is as it is. */
export function redacted(text, token) {
  const plain = text === undefined || text === null ? '' : String(text);
  return typeof token === 'string' && token !== '' ? plain.split(token).join('<token>') : plain;
}

/** The two rules the practice project keeps of its own (odd/tasks/project-rules.md, T6): one in prose, found by its
 * phrase in a file the project owns, and one its test sensor enforces. The home is not `AGENTS.md`, which `init`
 * wrote: a rule's line there would make `uninstall` keep that file as changed, and the step `project-uninstall`
 * proves that it removes it. */
export const PRACTICE_RULES = Object.freeze({
  prose: 'no-hand-deploy',
  sensor: 'tests-pass',
  phrase: 'Never deploy the practice project by hand',
});

/** The files of the practice project's own rules, by path from its top: its list and the home of its rule in
 * prose. The step writes and commits them when they are not as here, so every run after the first finds them. */
export function practiceRuleFiles() {
  const rules = [
    { id: PRACTICE_RULES.prose, subject: 'how the practice project is deployed', since: '2026-10-14', path: 'docs/conventions.md', phrases: [PRACTICE_RULES.phrase] },
    { id: PRACTICE_RULES.sensor, subject: 'the tests of the practice project pass', since: '2026-10-14', sensor: 'tests' },
  ];
  return {
    'docs/conventions.md': `# Conventions\n\n- ${PRACTICE_RULES.phrase}: it has no deploy, and the rule is here to be checked.\n`,
    'docs/rules.json': `${JSON.stringify({ format: 1, rules }, null, 2)}\n`,
  };
}

/** The list `text` without the rule `id`, written as the step writes a list: what a commit that deletes a rule
 * instead of retiring it stages. */
export function listWithout(text, id) {
  const data = JSON.parse(text);
  return `${JSON.stringify({ ...data, rules: data.rules.filter((rule) => rule.id !== id) }, null, 2)}\n`;
}

/** The steps that run whatever failed before them: the proof that the real home was left alone, and the
 * record of the run, matter most when something went wrong. */
export const ALWAYS_RUN = Object.freeze(['real-home-after', 'record']);

/** Walks `journey` in order and says how the run ended. `steps` holds one function per id; each is called
 * with `ctx` and returns its evidence as text, or throws with the reason it failed. A step that throws has
 * failed, with what it threw as its detail (the message of an error, anything else as text), and so has a
 * step of the journey that `steps` has no function for. After the first failure the steps that follow are
 * skipped, except those of `alwaysRun`.
 *
 * The result of each step that ran, `{ id, ok, detail }`, is pushed to `ctx.results` (an array the caller
 * made) as the step ends, so a later step reads those before it: the record step writes them down. Nothing
 * is printed here: `report` is handed the facts of one line per step, `{ status, id, title, detail }` with
 * the status `PASS` or `FAIL`, and `{ status: 'SKIP', id, title, failed }` with the id of the step that
 * failed. A `report` that throws (an output that was closed) does not end the walk: the comparison of the
 * real home and the record still have to happen.
 *
 * Returns `{ ok, passed, failed, unreported }`: how many steps passed, the id of the first that failed
 * (`undefined` when none did), `ok`, true only when every step of the journey passed and it has at least
 * one, and `unreported`, what the first `report` that threw said (`undefined` when every line was told). */
export function walkJourney({ journey = JOURNEY, steps, ctx, alwaysRun = ALWAYS_RUN, report = () => {} }) {
  let failed;
  let unreported;
  let passed = 0;
  const tell = (line) => {
    try {
      report(line);
    } catch (thrown) {
      unreported ??= reasonOf(thrown);
    }
  };
  for (const { id, title } of journey) {
    if (failed !== undefined && !alwaysRun.includes(id)) {
      tell({ status: 'SKIP', id, title, failed });
      continue;
    }
    let result;
    try {
      if (typeof steps[id] !== 'function') throw new Error(`the journey names the step ${id}, and scripts/practice.mjs has no code for it`);
      result = { id, ok: true, detail: steps[id](ctx) };
      passed += 1;
    } catch (thrown) {
      result = { id, ok: false, detail: reasonOf(thrown) };
      failed ??= id;
    }
    ctx.results.push(result);
    tell({ status: result.ok ? 'PASS' : 'FAIL', id, title, detail: result.detail });
  }
  return { ok: journey.length > 0 && passed === journey.length, passed, failed, unreported };
}

/** What was thrown, as text: the message of an error, and anything else (a step may throw a plain text) as
 * the text it gives, so a failure never has an empty reason. */
const reasonOf = (thrown) => (thrown instanceof Error ? thrown.message : String(thrown));

/** The `js-harness` commands of the step `project-adopt`, in order: a project not yet initialized gets
 * `init`; an initialized one, which is every run after the first, gets `status` and then `sync`, the new
 * version arriving at a project that already has the harness. */
export function adoptionCommands(initialized) {
  return initialized ? ['status', 'sync'] : ['init'];
}

// ---- the record ------------------------------------------------------------------------------------------------------

/** The line a run appends to `record.jsonl`: one line of JSON with no line break in it (the caller adds the
 * one that ends it). `date` is the moment of the run as text, `candidate` the checkout that was proven
 * (`{ branch, commit, dirty }`: the product cannot tell two copies apart, every one reads the same version),
 * `steps` the result of each step that ran (`{ id, ok, detail }`), `node` and `platform` what it ran on.
 *
 * `ok` is true only for a whole journey that passed: every step that ran is ok, at least one ran, and the
 * steps are those of `journey` (the journey of `run` unless another is handed in; its ids are what counts),
 * each exactly once and no other. A step that was skipped is not in `steps`, so a run with a failure is
 * never ok, and neither is a part of the journey that happened to pass, nor a line with a step from
 * elsewhere in it: the line is the lasting proof of a run. The journey itself is not written into the line. */
export function recordLine({ date, candidate, steps, node, platform, journey = JOURNEY, left, host }) {
  const results = steps.map(({ id, ok, detail }) => ({ id, ok, detail }));
  const once = ({ id }) => results.filter((step) => step.id === id).length === 1;
  // As many results as the journey has steps, and each of its ids once: so none of another journey.
  const whole = results.length > 0 && results.length === journey.length && journey.every(once);
  const ok = whole && results.every((step) => step.ok === true);
  const { branch, commit, dirty } = candidate;
  // The steps a run was told to leave out (`--no-host`, `--only`) and what its host session cost, each only when
  // there is one: a run that left a step out is not whole, so it is never ok.
  return JSON.stringify({
    date, ok, candidate: { branch, commit, dirty }, steps: results, node, platform,
    ...(left !== undefined && left.length > 0 && { left }),
    ...(host !== undefined && { host }),
  });
}

// ---- the release -----------------------------------------------------------------------------------------------------

/** Whether the sha `recorded`, as a record line keeps it (`git rev-parse --short`), names the full sha `commit`. A
 * prefix must be at least seven characters: git's own default for a short sha, and a shorter one would name too many
 * commits to be proof of one. Lower case is compared as lower case, since git prints hex in either. */
const namesCommit = (recorded, commit) => typeof recorded === 'string'
  && /^[0-9a-f]{7,40}$/i.test(recorded)
  && commit.toLowerCase().startsWith(recorded.toLowerCase());

/** What keeps one run of a commit from being the proof of its release, as a list of short entries; empty when the run
 * is a whole pass of the journey on a clean candidate. The host session is named apart from the rest: a release needs
 * its pass, and a run that left it out says so in `left` (`run --no-host`), so it is never read as a pass. */
function releaseProblems(line) {
  const problems = [];
  const left = Array.isArray(line.left) ? line.left : [];
  const steps = Array.isArray(line.steps) ? line.steps : [];
  if (line.candidate?.dirty !== false) problems.push('a dirty candidate: the tree had changes that were not committed, so the run proved more than the commit');
  if (left.length > 0) problems.push(`steps left out: ${left.join(', ')}`);
  const failed = steps.filter((step) => step.ok !== true).map(({ id }) => id);
  if (failed.length > 0) problems.push(`failed: ${failed.join(', ')}`);
  const hostPassed = steps.some(({ id, ok }) => id === HOST_STEP && ok === true);
  if (!hostPassed && !left.includes(HOST_STEP) && !failed.includes(HOST_STEP)) problems.push(`${HOST_STEP} did not run`);
  if (problems.length === 0 && line.ok !== true) problems.push('the run is not a whole pass of the journey');
  return problems;
}

/** Whether the practice record, `recordText` as the file holds it (or `null` when there is no file), proves the release
 * of the full sha `commit`. The proof is one line of a whole pass of the journey, the host session included, on a clean
 * candidate, whose commit is `commit`; any such line stands, so a later run that was refused does not undo an earlier
 * pass. A line that does not parse is an append that a crash cut short, and counts for nothing.
 *
 * Returns `{ ok: true, line }` for a release, or `{ ok: false, reason }` where `reason` says what is missing: no record, no
 * run of the commit, or the problems of its last run (`releaseProblems`). The commit is read here, not in the caller's
 * shell, so an annotated tag must be peeled to its commit before it is handed in. */
export function releasePracticeVerdict(recordText, commit) {
  if (!/^[0-9a-f]{40}$/i.test(commit ?? '')) return { ok: false, reason: 'the tagged commit is not a full sha, so no run of it can be read' };
  const short = commit.slice(0, 7);
  const lines = [];
  for (const text of String(recordText ?? '').split(/\r?\n/)) {
    if (text.trim() === '') continue;
    try {
      lines.push(JSON.parse(text));
    } catch {
      // A torn line: it counts for nothing, and the lines around it still do.
    }
  }
  if (lines.length === 0) return { ok: false, reason: 'no record: the practice record is missing or holds no run' };
  const mine = lines.filter((line) => namesCommit(line?.candidate?.commit, commit));
  if (mine.length === 0) return { ok: false, reason: `no run of ${short} in the record` };
  const passing = mine.find((line) => releaseProblems(line).length === 0);
  if (passing !== undefined) return { ok: true, line: passing };
  return { ok: false, reason: `no full pass of ${short}: its last run has ${releaseProblems(mine[mine.length - 1]).join('; ')}` };
}

// ---- the arguments ---------------------------------------------------------------------------------------------------

export const USAGE = `usage:
  node scripts/practice.mjs setup --root <dir>   create the practice folder
  node scripts/practice.mjs run --root <dir>     run the journey in it
    --no-host        leave out host-loads, the one step that spends a model (the record says so)
    --only <step>    run one step, on a folder that already holds a finished journey
There is no default root.`;

const COMMANDS = ['setup', 'run'];

/** Reads the arguments of the practice command: `{ command, root }` for `setup --root <dir>` and
 * `run --root <dir>`, and `{ error }` for anything else: no command, an unknown one, an unknown flag,
 * `--root` with no value or given twice, no `--root` at all (there is no default root), one argument too
 * many, and a root that does not say by itself where it is (`rootRefusal`, by the path rules of `platform`):
 * the command resolves the root against the folder it was started from, so the argument is judged here, as
 * it was typed. It never throws and never guesses: a command of this project once acted on a flag it did
 * not know.
 *
 * One `--` before the command is dropped, and only there: `npm run practice -- run --root <dir>` reaches the
 * script without it under npm and with it under pnpm, which hands the mark on. */
export function parseArgs(argv = [], platform = process.platform) {
  const [command, ...rest] = argv[0] === '--' ? argv.slice(1) : argv;
  if (command === undefined) return { error: 'no command: expected setup or run' };
  if (!COMMANDS.includes(command)) return { error: `unknown command ${command}: expected setup or run` };

  let root;
  let noHost = false;
  let only;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--no-host') {
      if (command !== 'run') return { error: '--no-host goes with run' };
      if (noHost) return { error: '--no-host was given twice' };
      noHost = true;
      continue;
    }
    if (arg === '--only') {
      if (command !== 'run') return { error: '--only goes with run' };
      if (only !== undefined) return { error: '--only was given twice' };
      const step = rest[i + 1];
      if (step === undefined || step === '' || step.startsWith('-')) return { error: '--only needs a value: the id of a step' };
      if (!JOURNEY.some(({ id }) => id === step)) return { error: `--only names a step of the journey, and ${step} is none` };
      only = step;
      i += 1;
      continue;
    }
    if (arg !== '--root') return { error: `${arg.startsWith('-') ? 'unknown flag' : 'unexpected argument'} ${arg}` };
    if (root !== undefined) return { error: '--root was given twice' };
    const value = rest[i + 1];
    if (value === undefined || value === '' || value.startsWith('-')) return { error: '--root needs a value: the folder of the practice' };
    root = value;
    i += 1;
  }
  if (noHost && only !== undefined) return { error: '--only and --no-host do not go together' };
  if (root === undefined) return { error: `${command} needs --root <dir>: there is no default root` };
  const ofRoot = rootRefusal(root, platform);
  if (ofRoot !== null) return { error: ofRoot };
  return { command, root, ...(noHost && { noHost }), ...(only !== undefined && { only }) };
}

// ---- the context pause, as the hook of the installed command meets it ----

/** One line of a made-up transcript: a reply of the session whose usage counts `tokens` input tokens, written as the
 * host writes one (`type`, `uuid`, `timestamp`, `message.usage`). The model is a made-up name, not `<synthetic>`,
 * which the reader of the pause does not count. The caller ends the line. */
export function pauseReplyLine({ uuid, timestamp, tokens }) {
  return JSON.stringify({
    type: 'assistant',
    uuid,
    timestamp,
    message: { model: 'made-up-model', role: 'assistant', usage: { input_tokens: tokens } },
  });
}

/** The hook input the host sends the pause command on standard input after a tool call, as JSON text: the session,
 * its transcript, its folder and the event (`PostToolUse`), the fields `pauseLine` of `bin/resume.mjs` reads. */
export function pauseHookInput({ sessionId, transcriptPath, cwd }) {
  return JSON.stringify({ session_id: sessionId, transcript_path: transcriptPath, cwd, hook_event_name: 'PostToolUse' });
}

/** What is wrong with the three runs of the pause command, or `null` when nothing is. `first` is a run in a project
 * with the session past the pause: it must exit 0 and print one line, the notice, which is JSON naming the event
 * `PostToolUse` with a non-empty `additionalContext`. `second` is the same input again, and `outside` a run in a
 * folder that is no project's, with a session past the pause too: both must exit 0 and print nothing. Each run is
 * `{ status, stdout }` of the child. The message names the run and says what it did, in words. */
export function pauseHookProblem({ first, second, outside }) {
  if (first.status !== 0) return `the first run exited ${first.status}, not 0`;
  // The line break `console.log` ends the line with is not part of what the hook printed.
  const notice = (first.stdout ?? '').replace(/\r?\n$/, '');
  if (notice.trim() === '') return 'the first run printed nothing, though the session was past the pause';
  if (/\r?\n/.test(notice)) return 'the first run printed more than one line, though its notice is one';
  let parsed;
  try {
    parsed = JSON.parse(notice);
  } catch {
    return `the first run printed text that is not JSON: ${notice}`;
  }
  const output = parsed?.hookSpecificOutput;
  if (output?.hookEventName !== 'PostToolUse') return `the first run names the event ${JSON.stringify(output?.hookEventName)}, not PostToolUse`;
  if (typeof output.additionalContext !== 'string' || output.additionalContext.trim() === '') {
    return 'the first run gives no additionalContext, or an empty one, so the session would be told nothing';
  }
  if (second.status !== 0) return `the second run exited ${second.status}, not 0`;
  const again = (second.stdout ?? '').replace(/\r?\n$/, '');
  if (again.trim() !== '') return `the second run printed ${again}, though the pause is said once`;
  if (outside.status !== 0) return `the run outside a project exited ${outside.status}, not 0`;
  const elsewhere = (outside.stdout ?? '').replace(/\r?\n$/, '');
  if (elsewhere.trim() !== '') return `the run outside a project printed ${elsewhere}, though no harness.json is above its folder`;
  return null;
}

// ---- the channel, as the installed project meets it (odd/tasks/session-channel.md, T10) ----

// The names `channelEnv` replaces: the two a child reads its home from (`os.homedir()` takes USERPROFILE on Windows and
// HOME elsewhere), the harness's home, and the two by which a command started from a live session reaches that
// session's files: its id (`notify` reads the sender's transcript by it) and its config folder (the Claude home both
// commands read the sessions from when no `--claude-home` is given).
const CHANNEL_REPLACED = ['HOME', 'USERPROFILE', 'JS_HARNESS_HOME', 'CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_SESSION_ID'];

/** Where `notify` records the notices of the project `slug` under the home `home` (`recordPath` of
 * `bin/lib/channel.mjs`). Spelled here, as `gateLogFolder` is, because the practice looks at the candidate from outside;
 * a test holds the two spellings together. The step reads the real home's record by it, to show the notice is not there. */
export function channelRecord(home, slug, platform = process.platform) {
  return pathFor(platform).join(home, '.js-harness', 'channel', `${slug}.jsonl`);
}

/** The environment of the two commands of the step `channel`, as a new object; `baseEnv` (the practice's `childEnv`)
 * is left as it is. `notify` and the board find the record under the harness home, which is `JS_HARNESS_HOME` or the
 * user's home: both are the practice home here, so a command that ignored the one would still write and read there,
 * and never in the real home. The host session's id and config folder are dropped, so the session that starts a run
 * is never taken for the sender and its transcripts are never read. Windows does not tell names apart by case: every
 * spelling of a replaced name goes, and the result holds each once. */
export function channelEnv(baseEnv, home, platform = process.platform) {
  const windows = platform === 'win32';
  const replaced = (name) => CHANNEL_REPLACED.includes(windows ? name.toUpperCase() : name);
  return {
    ...Object.fromEntries(Object.entries(baseEnv).filter(([name]) => !replaced(name))),
    HOME: home,
    USERPROFILE: home,
    JS_HARNESS_HOME: home,
  };
}

/** How a child of the step ended, for its message: the spawn error, or its exit code. */
const endedAs = (result) => (result.error ? result.error.message : `exit ${result.status}`);
/** The first line of `text` that is not blank, or `null`. */
const firstLine = (text) => String(text ?? '').split(/\r?\n/).find((line) => line.trim() !== '') ?? null;
const failedRun = (what, result) => `${what} failed (${endedAs(result)}): ${firstLine(result.stderr) ?? 'it printed nothing on stderr'}`;

/** What is wrong with the step `channel`, or `null` when nothing is. `notify` is the run of the installed
 * `js-harness notify --to orchestrator --kind note "<a line holding marker>"` in the practice project, and `board` the
 * run of `js-harness sessions --json` after it, each `{ status, stdout, stderr, error? }` of the child. `notify` must
 * exit 0; the real home's record of the project (`realRecord`, its text, or `null` when there is none) must not hold
 * `marker`; the board must exit 0 and print JSON whose `channel` was read from a record under the practice home `home`
 * and lists, among its last notices, one whose text holds `marker`. The real home is looked at before the board: a
 * notice written there instead would otherwise read only as a board that does not show it. One line names what failed. */
export function channelStepProblem({ notify, board, marker, home, realRecord = null, platform = process.platform }) {
  if (notify.error || notify.status !== 0) return failedRun('js-harness notify', notify);
  if (typeof realRecord === 'string' && realRecord.includes(marker)) return `the real home's channel record holds ${marker}: the notice reached the real home`;
  if (board.error || board.status !== 0) return failedRun('js-harness sessions --json', board);
  let parsed;
  try {
    parsed = JSON.parse(board.stdout);
  } catch {
    return `js-harness sessions --json printed text that is not JSON: ${firstLine(board.stdout) ?? '(nothing)'}`;
  }
  const channel = parsed?.channel;
  if (!Array.isArray(channel?.notices)) return 'the board shows no channel notices: its JSON has no channel.notices list';
  if (typeof channel.path !== 'string' || !isInside(home, channel.path, platform)) {
    return `the board read the channel's record at ${channel.path}, outside the practice home ${home}`;
  }
  if (!channel.notices.some((notice) => typeof notice?.text === 'string' && notice.text.includes(marker))) {
    return `no notice on the board holds ${marker}: it shows ${channel.notices.length} of the ${channel.noticeCount} notices of ${channel.path}`;
  }
  return null;
}

// ---- the tools that open a session where he does not see it, as the guard meets them ----

/** The four tools the guard refuses where the rule `sessions-open-in-sidebar` is declared, as `bin/lib/guard.mjs` names
 * them (`OPENING_TOOLS`); a test holds the two together. A session these open runs in the app's Routines or in the cloud. */
export const OPENING_TOOLS = Object.freeze([
  'mcp__scheduled-tasks__create_scheduled_task',
  'mcp__scheduled-tasks__update_scheduled_task',
  'mcp__scheduled-tasks__run_scheduled_task',
  'RemoteTrigger',
]);

/** The hook input the host sends the guard on standard input before a tool call, as JSON text: the session, its folder,
 * the event (`PreToolUse`) and the tool, with an empty input, since the refusal of these tools reads no input. */
export function openingToolInput({ sessionId, cwd, tool }) {
  return JSON.stringify({ session_id: sessionId, cwd, hook_event_name: 'PreToolUse', tool_name: tool, tool_input: {} });
}

/** What is wrong with the guard's answers to the four tools, or `null`. `plain` holds a run for each tool in a project
 * that declares no rule: each must exit 0 and print nothing, so the tool passes. `declared` holds a run for each tool in
 * the project that declares the rule: each must exit 0 and print the hooks contract's deny, whose reason names the tool
 * and `start_session`. Each run is `{ status, stdout }` of the child, keyed by the tool's name. The message names the
 * tool and says what the guard did, in words. */
export function openingToolsProblem({ plain, declared }) {
  for (const tool of OPENING_TOOLS) {
    const quiet = plain[tool];
    if (quiet?.status !== 0) return `the guard exited ${quiet?.status} on ${tool} in a project that declares no rule, not 0`;
    const printed = (quiet.stdout ?? '').replace(/\r?\n$/, '');
    if (printed.trim() !== '') return `the guard refused ${tool} in a project that declares no rule: ${printed}`;
  }
  for (const tool of OPENING_TOOLS) {
    const refused = declared[tool];
    if (refused?.status !== 0) return `the guard exited ${refused?.status} on ${tool} in the project that declares the rule, not 0`;
    const printed = (refused.stdout ?? '').replace(/\r?\n$/, '');
    // Silence is the guard letting the call run, which is the very thing this step must not see here.
    if (printed.trim() === '') return `the guard let ${tool} run in the project that declares the rule, though its scheduled session would open where he does not see it`;
    let answer;
    try {
      answer = JSON.parse(printed);
    } catch {
      return `the guard printed for ${tool} in the project that declares the rule text that is not JSON: ${printed}`;
    }
    const output = answer?.hookSpecificOutput;
    if (output?.hookEventName !== 'PreToolUse' || output.permissionDecision !== 'deny') {
      return `the guard let ${tool} run in the project that declares the rule, though its scheduled session would open where he does not see it`;
    }
    const reason = typeof output.permissionDecisionReason === 'string' ? output.permissionDecisionReason : '';
    if (!reason.includes(tool) || !reason.includes('start_session')) {
      return `the refusal of ${tool} does not name the tool and start_session: ${reason}`;
    }
  }
  return null;
}

// ---- the reply check, as a Stop hook meets it (odd/tasks/rule-hierarchy.md, T12) ----

/** The hook input the host sends a `Stop` hook on standard input, as JSON text: the session, its folder, the event, the
 * reply that ends the turn and no background work running, the fields `bin/reply.mjs` reads. */
export function replyHookInput({ sessionId, cwd, message }) {
  return JSON.stringify({ session_id: sessionId, cwd, hook_event_name: 'Stop', stop_hook_active: false, last_assistant_message: message, background_tasks: [] });
}

/** The run's answer as JSON, or the reason it is none: a `Stop` hook answers with one JSON object, `{}` to let the session
 * stop. */
function replyAnswer(run, which) {
  if (run?.status !== 0) return { problem: `the reply check exited ${run?.status} on ${which}, not 0` };
  const printed = (run.stdout ?? '').trim();
  return printed === '' ? { printed } : { printed, answer: (() => { try { return JSON.parse(printed); } catch { return undefined; } })() };
}

/** What is wrong with the three runs of the reply check, or `null`. `refused` is a reply with no state, in a folder whose
 * `harness.json` holds `"reply": true` (the practice project, whose `harness.json` from `init` turns the check on):
 * it must be turned back with `decision: "block"` and a reason that names the English label `Working`. `passed` is a
 * reply there that closes with `Working — …`, and `plain` the reply with no state in a folder outside any project, where
 * no `harness.json` lies above: both must print `{}`. Each run is `{ status, stdout }` of the child. */
export function replyHookProblem({ refused, passed, plain }) {
  const turned = replyAnswer(refused, 'the reply with no state');
  if (turned.problem) return turned.problem;
  if (turned.answer?.decision !== 'block') return `the reply check let a reply with no state stop in the folder whose harness.json turns it on: ${turned.printed}`;
  const reason = typeof turned.answer.reason === 'string' ? turned.answer.reason : '';
  if (!reason.includes('Working')) return `the reply check turned the reply back without naming the state Working: ${reason}`;
  for (const [run, which, where] of [
    [passed, 'the reply that closes with its state', 'a reply that closes with its state'],
    [plain, 'the reply outside any project', 'a reply outside any project, where no harness.json turns it on'],
  ]) {
    const read = replyAnswer(run, which);
    if (read.problem) return read.problem;
    if (read.printed === '') return `the reply check printed nothing ${run === plain ? 'outside any project' : 'in the folder whose harness.json turns it on'}, though a Stop hook answers with JSON`;
    if (read.answer === undefined || Object.keys(read.answer).length !== 0) return `the reply check turned back ${where}: ${read.printed}`;
  }
  return null;
}
