// The install/sync/uninstall engine: components are data, so adding one never
// touches the fs-walking logic below, and uninstall can undo exactly what install wrote.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync as spawnChildSync } from 'node:child_process';
import { cachePath } from './cache.mjs';
import { gateDir, readGateHolder, readGateWaiters } from './gate-lock.mjs';
import { gateLogDir } from './gate-log.mjs';
import { channelDir } from './channel.mjs';

function skillContent(version) {
  return `---
name: js-harness
description: Install, update, and check js-harness (v${version}) status and commands.
---

js-harness commands:
- \`js-harness status --global\` — installed version, manifest version, and latest available, for the machine.
- \`js-harness install\` — write the skills and the session-start hook entries, and record a manifest under the home.
- \`js-harness sync --global\` — re-write installed files for the running version.
- \`js-harness update\` — check whether a newer release exists.
- \`js-harness upgrade\` — install the newer release, then sync.
- \`js-harness uninstall --global\` — remove exactly what install wrote.
- \`js-harness codex-review --base <rev>\` — run \`codex exec review\` over <rev>..HEAD and record it, only when its successful commands showed every changed line of the patch; \`--unavailable <reason>\` records a skip when Codex cannot run.
- \`js-harness check\` — the gate of a commit. Its sensors run one gate at a time on the machine: it waits for its turn, in the order the gates arrived, and gives up once the lock has gone 60 minutes without changing hands (\`--wait <minutes>\`), or refuses at once (\`--no-wait\`).
- \`js-harness gate -- <command>\` — a heavy run that is not a commit's gate (a whole test suite by hand, a batch of evals), under the same lock: it waits for its turn like a gate (\`--wait <minutes>\`, \`--no-wait\`), and its exit code is the command's.
- \`js-harness check --push\` — the gate a push must pass, and the only check it runs: every code commit since the remote's default branch lies in a recorded Codex review (\`--remote <name>\`, default origin).
- \`js-harness sessions\` — the board of the project's Claude Code sessions, worktrees, running gates and open pull requests, read-only; \`--watch\` waits and returns when it changes. The \`js-harness-orchestrator\` skill says how sessions share a project.

Without \`--global\`, \`status\`, \`sync\` and \`uninstall\` act on the project inside an initialized repository
(report it, move it to its pin, undo it) and refuse in a git repository that is not one.
`;
}

/** The second skill: how several sessions share one project. A session that supervises the others reads
 * the orchestrator's part, a session that works next to others reads the work session's; the design is
 * in odd/tasks/session-board.md ("The orchestrator"). Every line is paid each time a host loads it. */
function orchestratorSkillContent(version) {
  return `---
name: js-harness-orchestrator
description: Use when asked to orchestrate, supervise or watch the other sessions of a project, and in a work session that runs while other sessions of the project are open, for how it prompts and how it closes (js-harness v${version}).
---

# Several sessions, one project

Two kinds of session. A work session owns one feature: its worktree, its feature document (\`odd/tasks/<feature>.md\`) and its own prompts. The orchestrator is a dedicated session that owns no feature. Follow the part that is yours.

A change does not exist until it is in a file. Where each thing lives:
- the project's plan (the order of the features, the decisions): the roadmap on the default branch, changed through small documentation pull requests;
- a feature's plan (tasks, progress, next step): its feature document on its branch, written only by the session that owns the feature;
- what is in flight between sessions and in neither file yet (the user's decisions, open questions, notices not yet delivered, what each session is for): the orchestrator's relief file;
- the facts (who works, what runs, gates, branches, context sizes): stored nowhere, computed by \`js-harness sessions\`.

## The orchestrator

What you run:
- \`js-harness sessions\` — the board: each session's state, context size, open background work and the tail of its last reply, then the worktrees with their feature plans, the running gates, the open pull requests and your relief file.
- \`js-harness sessions --watch\`, in the background — your way of waiting. It is silent until the board changes in a way that needs a decision, then prints the changes and the board. Launch it again each time it returns. A return with "nothing changed" is not news: relaunch it and say nothing.
- \`js-harness progress\` — the map: the roadmap's phases and the features, from their checkboxes.

What you may do:
- You read. The only file you write is your relief file.
- You never implement, never commit, never write in a worktree and never answer for the user. Reading code, running tests and discussing a design are what fill a context, and yours has to last.
- You never write another session's prompts: each session owns its work and holds its context. The one exception is the opening prompt of a new work session, which carries pointers and not content: what to read first, the decisions already taken, how the machine is shared.

When the user asks for something, place it with the roadmap and the board:
- work of a feature whose session is open goes to that session, and the user says it there in their own words;
- new work gets the opening prompt of a new work session; a design conversation is a session of its own too;
- note in the relief file what was asked and where it went, and go back to waiting.

Write to the user only when:
1. a session starts waiting on them;
2. a session finished with nothing running behind it;
3. two gates run at once (a gate that waits for its turn is not one of them);
4. a prompt they hold became stale;
5. a feature's plan changed: say what changed, the reason its document gives, and which other session it touches, with a one-line notice for that session, which updates its own document;
6. a session's context passed the limit.
Say for each session concerned whether to send that session's own prompt, wait, or drop it. Otherwise stay silent.

The relief file. \`js-harness sessions\` prints its path and its last lines under \`Relief\`.
- Append one dated line per event as it happens: a decision of the user, a request and where it went, a question still open, a notice not yet delivered, what a session is for. Your first line says that an orchestrator started and gives your session id, the one the board marks \`(this session)\`.
- Never rewrite or summarize it, and never leave a line for later: this session can die without warning, and what is not in the file dies with it.

Relief, not compaction. You hold nothing the files do not, so you are replaced instead of compacted.
- A watch never reports the session that runs it, so read your own row on every board. When it says your context is past the limit, tell the user and give them this opening prompt for a new session, always the same:

\`\`\`
You are the orchestrator of this project's sessions. Follow the js-harness-orchestrator skill: you take over from the orchestrator before you.
\`\`\`

- When you start from that prompt, read the relief file, the board and the last reply of the orchestrator before you (its id is in the relief file; \`js-harness sessions --tail <n>\` prints more lines of every last reply). Then say that you are watching. The user archives the old orchestrator only after that, so there are never two.
- When you come back from a compaction, do what a new orchestrator does: the files are the record, your summary is not.

## A work session

- Give prompts only for yourself. A prompt meant for another session names that session in its first line. When you receive one addressed to another session, touch nothing and say whose it is.
- Your commit's gate waits by itself while another runs: \`Gates\` in \`js-harness sessions\` says which runs and which wait. A whole test run of your own goes through \`js-harness gate -- <command>\`, which waits for its turn too.
- When your plan changes (something failed, came out differently or a problem appeared), write it in your own feature document before going on: the task reopened or added, with the reason, committed.
- When you have finished, say so in your first line. Your last prompt is the closing notice to the orchestrator: what you delivered, and that nothing more goes to you.
- You are not finished while background work you started is still running, even when your next prompt is already written.
`;
}

/** Components are data: where each one lives under a home, and what it contains at a version. */
export const components = [
  {
    id: 'claude-skill',
    target: (home) => path.join(home, '.claude', 'skills', 'js-harness', 'SKILL.md'),
    content: skillContent,
  },
  {
    id: 'codex-skill',
    target: (home) => path.join(home, '.codex', 'skills', 'js-harness', 'SKILL.md'),
    content: skillContent,
  },
  {
    id: 'claude-orchestrator-skill',
    target: (home) => path.join(home, '.claude', 'skills', 'js-harness-orchestrator', 'SKILL.md'),
    content: orchestratorSkillContent,
  },
  {
    id: 'codex-orchestrator-skill',
    target: (home) => path.join(home, '.codex', 'skills', 'js-harness-orchestrator', 'SKILL.md'),
    content: orchestratorSkillContent,
  },
];

/** Entry-level components: one JSON value js-harness appends to an array at `pointer` inside a
 * JSON file it does not own (e.g. another host's hook list). Unlike `components` above, install
 * never owns the whole file — only the one entry it grafts on, so every operation here reads,
 * patches and writes back the smallest possible diff instead of overwriting the file. */
export const entryComponents = [
  {
    id: 'claude-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'SessionStart'],
    entry: () => hookEntry(),
  },
  {
    id: 'codex-hook',
    target: (home) => path.join(home, '.codex', 'hooks.json'),
    pointer: ['hooks', 'SessionStart'],
    entry: () => hookEntry(),
  },
  {
    id: 'claude-resume-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'SessionStart'],
    entry: () => resumeHookEntry(),
  },
  {
    id: 'codex-resume-hook',
    target: (home) => path.join(home, '.codex', 'hooks.json'),
    pointer: ['hooks', 'SessionStart'],
    entry: () => resumeHookEntry(),
  },
  {
    id: 'claude-pause-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'PostToolUse'],
    entry: () => pauseHookEntry(),
  },
];

/** `doctor --hook` (T3) registered as a `SessionStart` hook: zero model tokens on a session start
 * with nothing new to report (see odd/tasks/stack-doctor.md, "Registration"). */
function hookEntry() {
  return {
    matcher: 'startup|resume',
    hooks: [{ type: 'command', command: 'js-harness doctor --hook', timeout: 10 }],
  };
}

/** `resume --hook` (bin/resume.mjs) registered as a `SessionStart` hook for the matcher `compact`: after
 * a compaction the session reads its title, its opening and its feature document from files, so nobody
 * pastes it a resume prompt (odd/tasks/session-channel.md, "Context"). Both hosts match a `SessionStart`
 * entry against the way the session started, and both name a compaction `compact` (their hooks
 * documentation, read on 2026-10-11; in this project's Claude Code transcripts the hooks of other tools
 * ran under `SessionStart:compact` after 40 compactions). It is an entry of its own because the doctor's
 * matcher must not fire on a compaction. Fifteen seconds: the command asks git a handful of questions,
 * each with a limit of its own. */
function resumeHookEntry() {
  return {
    matcher: 'compact',
    hooks: [{ type: 'command', command: 'js-harness resume --hook', timeout: 15 }],
  };
}

/** The command of the pause hook. The `|| exit 0` is the point: a hook that exits 2 blocks its host, and an older
 * copy of js-harness on the path answers 2 to a command or a flag it does not know (it happened to `resume` itself
 * on 2026-10-12), so whatever the command answers, the entry exits 0. The form is one that both `sh` and `cmd.exe`
 * read. Which shell a Windows host runs a hook's command in is not proven here: it is one of the tries the feature
 * document lists. */
export const PAUSE_HOOK_COMMAND = 'js-harness resume --pause || exit 0';

/** `resume --pause` (bin/resume.mjs) registered as a `PostToolUse` hook: after a tool call that passes the context
 * pause it prints the notice, once for the stretch of work (odd/tasks/session-channel.md). Claude Code only: the
 * pause is read from a Claude Code transcript, and a Codex session has none here, so there is no Codex entry. No
 * matcher, so the entry runs after every tool, which is what the notice needs. Two seconds: a short budget, since
 * the hook runs after every tool call. */
function pauseHookEntry() {
  return {
    hooks: [{ type: 'command', command: PAUSE_HOOK_COMMAND, timeout: 2 }],
  };
}

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** Structural equality for plain JSON values (objects/arrays/primitives) — used to recognize "the
 * same entry" regardless of key order, so a file re-saved by another tool still matches. */
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object') {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

/** R3-003 (accepted T4 review follow-up): true when `value` holds nothing but our own `pointers`: every key
 * must lead, along one of them, to what we wrote, and every key that ends a pointer must hold the empty array we
 * left behind after removing our entry. Any other key, even one with an empty-looking value like `{}` or `null`,
 * means this document is not ours alone to delete. Several pointers can share one file: the doctor's and the
 * resume hook's both hang from `hooks.SessionStart`, and the pause hook hangs from `hooks.PostToolUse`, so a file
 * js-harness created goes with the last of them. */
function isOnlyOurPointerPaths(value, pointers) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).every((key) => {
    const below = pointers.filter((pointer) => pointer[0] === key).map((pointer) => pointer.slice(1));
    if (below.length === 0) return false;
    if (below.some((pointer) => pointer.length === 0)) return Array.isArray(value[key]) && value[key].length === 0;
    return isOnlyOurPointerPaths(value[key], below);
  });
}

/** R3-005 (accepted T4 review follow-up): detects the indent unit already used by `raw` so a
 * rewrite matches it instead of always reformatting to 2 spaces. `null` means compact single-line
 * JSON (no newlines besides, at most, one trailing one) and must stay compact; a tab or space run
 * right after the first real newline becomes the indent unit; anything else (a multi-line document
 * with no indented line, which should not normally happen) falls back to the historical default. */
function detectIndent(raw) {
  const body = raw.replace(/\r?\n$/, '');
  if (!body.includes('\n')) return null;
  const match = /\n([\t ]+)\S/.exec(body);
  if (!match) return 2;
  return match[1].includes('\t') ? '\t' : match[1].length;
}

function serializeJson(data, { trailingNewline, useCRLF, indent }) {
  let text = indent === null ? JSON.stringify(data) : JSON.stringify(data, null, indent);
  if (trailingNewline) text += '\n';
  if (useCRLF) text = text.replace(/\n/g, '\r\n');
  return text;
}

/** The key of a container inside `target`: the file and the keys from its root down to it. Two entries of ours in one file
 * that share a container (`hooks` for both `SessionStart` entries) get the same key, which is how one entry finds what the
 * other made. */
const containerKey = (target, keys) => JSON.stringify([target, ...keys]);

/** The containers js-harness made, as `containerKey`s, from what the earlier records say: each record names how many of
 * the containers on its pointer were made by install (`createdContainers`), counted up from the array at the pointer. A
 * later install that finds one already there still knows it is ours, so a re-install never forgets what the first one made. */
function oursContainers(entries) {
  const ours = new Set();
  for (const record of entries ?? []) {
    const made = record.createdContainers ?? 0;
    for (let i = Math.max(0, record.pointer.length - made); i < record.pointer.length; i += 1) {
      ours.add(containerKey(record.path, record.pointer.slice(0, i + 1)));
    }
  }
  return ours;
}

/** How many containers, counted up from the array at the pointer, are ours. `ourContainers[i]` says whether the container
 * keyed by `pointer[i]` is; the count stops at the first one that is not, since a container is only ours with the ones
 * below it. */
function countOurs(ourContainers) {
  let count = 0;
  for (let i = ourContainers.length - 1; i >= 0 && ourContainers[i]; i -= 1) count += 1;
  return count;
}

/** Appends `entry` at `pointer` inside the JSON file at `target`, creating intermediate objects
 * and the array itself as needed. Missing file -> starts from `{}` (`createdFile: true`).
 * `ours` is the set of containers js-harness made (`oursContainers`): every container this creates is added to it, so
 * the next entry of the same run that finds it there records it as made too, and the result says how many of the
 * containers on the way to `pointer` are ours (`createdContainers`).
 * Malformed JSON, a root/pointer shape that is not the object/array we expect, or any fs failure
 * reading or writing the target (R3-002: an unreadable file, a directory sitting at the path, an
 * unwritable or missing-as-a-directory host dir, ...) all leave the file completely untouched and
 * report `skipped`, never overwritten and never thrown out of install/sync. R3-001: an intermediate
 * key that already exists but is not a plain object, or a leaf that already exists but is not an
 * array, is treated the same way — a value of an unexpected shape is never clobbered. Idempotent:
 * an entry that is already there (by deep equality) is left alone and the file is not rewritten at
 * all, so a repeat install/sync never reformats a file that already has what it needs. */
function appendEntryToFile(target, pointer, entry, ours) {
  let fileExisted;
  let raw;
  try {
    fileExisted = fs.existsSync(target);
    raw = fileExisted ? fs.readFileSync(target, 'utf8') : '{}';
  } catch (err) {
    return { skipped: true, createdFile: false, reason: err.message };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { skipped: true, createdFile: false, reason: 'malformed JSON' };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { skipped: true, createdFile: false, reason: 'not a JSON object' };
  }

  const trailingNewline = raw.endsWith('\n');
  const useCRLF = raw.includes('\r\n');
  const indent = fileExisted ? detectIndent(raw) : 2;

  // `ourContainers[i]` says whether the container keyed by pointer[i] is ours: one this walk creates, or one an earlier
  // record or an entry of this run made. A container that is there and not ours is the user's, and is never removed.
  let cursor = data;
  const ourContainers = [];
  for (const [i, key] of pointer.slice(0, -1).entries()) {
    const existing = cursor[key];
    const id = containerKey(target, pointer.slice(0, i + 1));
    if (existing === undefined) {
      cursor[key] = {};
      ours.add(id);
    } else if (typeof existing !== 'object' || existing === null || Array.isArray(existing)) {
      return { skipped: true, createdFile: false, reason: `"${key}" is not an object` };
    }
    ourContainers.push(ours.has(id));
    cursor = cursor[key];
  }
  const lastKey = pointer[pointer.length - 1];
  const leafId = containerKey(target, pointer);
  const existingLeaf = cursor[lastKey];
  if (existingLeaf === undefined) {
    cursor[lastKey] = [];
    ours.add(leafId);
  } else if (!Array.isArray(existingLeaf)) {
    return { skipped: true, createdFile: false, reason: `"${lastKey}" is not an array` };
  }
  ourContainers.push(ours.has(leafId));
  const arr = cursor[lastKey];

  if (arr.some((item) => deepEqual(item, entry))) {
    return { skipped: false, createdFile: !fileExisted, createdContainers: countOurs(ourContainers) };
  }

  arr.push(entry);
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, serializeJson(data, { trailingNewline, useCRLF, indent }), 'utf8');
  } catch (err) {
    return { skipped: true, createdFile: false, reason: err.message };
  }
  return { skipped: false, createdFile: !fileExisted, createdContainers: countOurs(ourContainers) };
}

/** Whether a record says the list at its pointer is not one install made. A record that names no container as made
 * (`createdContainers: 0`) says so whether its entry was written or skipped: written, it went into a list that was
 * already there and that js-harness had not made. A record from before the field says nothing of it, and is taken
 * as it always was: the list is ours unless the entry was skipped. */
const ownsNoList = (record) => record.createdContainers === 0 || (record.createdContainers === undefined && record.skipped === true);

/** The pointers of every entry recorded for the file `target` in `records` whose list js-harness made: what is ours
 * in that file once the entries are out. A record that owns no list is left out: the list at its pointer is the
 * user's, and counted here it would let `uninstall` delete a file install created with that list in it. */
const pointersIn = (records, target) => (records ?? [])
  .filter((record) => record.path === target && !ownsNoList(record))
  .map((record) => record.pointer);

/** Removes the deep-equal entry at `pointer` inside `target`. A missing file, malformed JSON, a
 * pointer shape that does not match, or an entry that is not there (the user changed or removed
 * it) all leave the file completely untouched — reported `kept` (or nothing, for a missing file,
 * mirroring how `uninstall` already treats a missing file component). Deletes the whole file only
 * when `createdFile` is true (js-harness made it) and removing the entry leaves nothing but empty
 * containers behind. `createdContainers` is how many of the containers on `pointer` install made for the entry; each of
 * them that is empty once the entry is out goes too (`removeEmptyCreatedContainers`). `pointers` is every pointer
 * js-harness recorded in this file, which is what "ours" means for the last check (see `isOnlyOurPointerPaths`). */
function removeEntryFromFile(target, pointer, entry, createdFile, createdContainers = 0, pointers = [pointer]) {
  if (!fs.existsSync(target)) return { status: 'absent' };
  const raw = fs.readFileSync(target, 'utf8');

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { status: 'kept' };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { status: 'kept' };
  }

  const trailingNewline = raw.endsWith('\n');
  const useCRLF = raw.includes('\r\n');
  const indent = detectIndent(raw);

  let cursor = data;
  for (const key of pointer.slice(0, -1)) {
    if (typeof cursor[key] !== 'object' || cursor[key] === null || Array.isArray(cursor[key])) {
      return { status: 'kept' };
    }
    cursor = cursor[key];
  }
  const lastKey = pointer[pointer.length - 1];
  const arr = cursor[lastKey];
  if (!Array.isArray(arr)) return { status: 'kept' };

  const idx = arr.findIndex((item) => deepEqual(item, entry));
  if (idx === -1) return { status: 'kept' };
  arr.splice(idx, 1);

  // R3-003: only delete a file we created when nothing but empty containers along our own pointer
  // paths remains — any other key, even one with an empty-looking value, keeps the file.
  if (createdFile && isOnlyOurPointerPaths(data, pointers)) {
    fs.rmSync(target, { force: true });
    return { status: 'removed' };
  }

  removeEmptyCreatedContainers(data, pointer, createdContainers);
  fs.writeFileSync(target, serializeJson(data, { trailingNewline, useCRLF, indent }), 'utf8');
  return { status: 'removed' };
}

/** Takes out the containers install made for an entry, `createdContainers` of them counted up from the array at `pointer`,
 * each only when it is empty now: the array that held the entry, then the object above it. A container with anything
 * left in it, the user's or another entry's, stays, and so does everything above it. */
function removeEmptyCreatedContainers(data, pointer, createdContainers) {
  // holders[i] is the object that holds pointer[i]: holders[0] is the file's root.
  const holders = [data];
  for (const key of pointer.slice(0, -1)) holders.push(holders[holders.length - 1][key]);
  for (let i = pointer.length - 1; i >= 0 && i >= pointer.length - createdContainers; i -= 1) {
    const container = holders[i][pointer[i]];
    if (!isEmptyContainer(container)) return;
    delete holders[i][pointer[i]];
  }
}

function isEmptyContainer(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value !== null && typeof value === 'object' && Object.keys(value).length === 0;
}

/** Installs every entry component, carrying forward `createdFile` from a previous manifest record
 * for the same target file (matched by path) rather than recomputing it from "does the file exist
 * right now" — a file js-harness created on the first install still existed for every later
 * install/sync call, but js-harness must still remember it made it, so uninstall can delete it.
 *
 * Two components can graft an entry on the same file (the doctor's hook and the resume hook), and who
 * created the file is a fact of the file, not of the entry: the second entry of a first install finds the
 * file the first one has just made, and recorded as not created it would be the last one `uninstall`
 * removes and would leave the file behind. So every entry of one file carries what the first one of this
 * run settled for it.
 *
 * The same holds for the containers on the way to each pointer (`createdContainers`): the second `SessionStart` entry
 * finds the `hooks` object and the list the first one made, and records them as made too, since they are ours. The
 * set `ours` carries that from one entry to the next, and from the earlier records, so each entry's record says the
 * truth and whichever of the entries is removed last takes its containers with it. */
function installEntries(home, previousManifest) {
  const createdByTarget = new Map();
  const ours = oursContainers(previousManifest?.entries);
  return entryComponents.map((component) => {
    const target = component.target(home);
    const pointer = component.pointer;
    const entry = component.entry();
    const previousEntry = previousManifest?.entries?.find((e) => e.path === target);
    const result = appendEntryToFile(target, pointer, entry, ours);
    if (!createdByTarget.has(target)) createdByTarget.set(target, previousEntry ? previousEntry.createdFile : result.createdFile);
    // A run that skips an entry looked at no container: what an earlier run recorded as made for the same file and
    // pointer still holds. Written as none, the next install would take those containers for the user's, and
    // `uninstall` would leave them empty behind it.
    const earlier = previousManifest?.entries?.find((e) => Array.isArray(e.pointer) && containerKey(e.path, e.pointer) === containerKey(target, pointer));
    return {
      path: target,
      pointer,
      entry,
      sha256: sha256(JSON.stringify(entry)),
      createdFile: createdByTarget.get(target),
      createdContainers: result.createdContainers ?? (result.skipped ? earlier?.createdContainers ?? 0 : 0),
      skipped: result.skipped === true,
      ...(result.skipped ? { reason: result.reason } : {}),
    };
  });
}

export function manifestPath(home) {
  return path.join(home, '.js-harness', 'manifest.json');
}

export function readManifest(home) {
  const file = manifestPath(home);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** The version `install` recorded under `home`, or `null` when nothing is installed there: no manifest, or one
 * that only records optional files (`recordOptionalFile` writes it with a `null` version). Whoever reports or
 * compares the installed version asks this, so that manifest is never printed as a version. */
export function installedVersion(home) {
  return readManifest(home)?.version ?? null;
}

function writeManifest(home, manifest) {
  const file = manifestPath(home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2), 'utf8');
}

/** Optional files: a file js-harness writes outside the home's own folders only when asked (the login launcher
 * of `remote start --at-login`, in the Windows Startup folder), kept in the manifest's `optional` array as
 * `{ path, sha256 }`, apart from `files`. No component declares one, so `install` and `sync` carry the array
 * forward as it is and never write, prune or drop such a file; `uninstall` removes each one whose bytes are
 * still what was recorded, and never the folder it is in, which is not ours.
 *
 * Records that `content` (a string, or the bytes) was written to `file`, replacing any record of that path. With
 * no manifest (js-harness was never installed on this machine) it creates one whose `version` is `null`, with no
 * files and no entries. What each reader of the manifest does with that one:
 *  - `status --global` and `upgrade` (`bin/update.mjs`) ask `installedVersion`, which answers `null`, and say
 *    `(not installed)`;
 *  - `install` and `sync` do what they do with no manifest (write every component, set the version) and carry
 *    `optional` forward;
 *  - `uninstall` finds no component and no entry to remove, removes the optional files and the scheduled tasks
 *    (`recordScheduledTask`, kept the same way in `tasks`) and then the manifest;
 *  - `remote` (`bin/remote.mjs`) reads only `optional` and `tasks`, and when `start --at-login` fails halfway
 *    puts back its own two records and nothing else (`putOptionalRecordBack`, `putTaskRecordBack`);
 *  - `doctor` (`recordedLaunchers` in `bin/lib/stack.mjs`) reads only `optional`, for the login launchers.
 * Nothing else reads the machine manifest (`rg -n "readManifest|installedVersion" bin`, the tests left out,
 * 2026-10-11). */
export function recordOptionalFile(home, file, content) {
  const record = { path: file, sha256: sha256(content) };
  return keepRecord(home, 'optional', record, (entry) => entry.path === file);
}

/** Forgets the record of `file`, never touching the file itself; `false` when there was none. An empty `optional`
 * is dropped, so the manifest reads as it did before the first record, and a manifest left with nothing in it
 * (the one `recordOptionalFile` created) is removed, with its folder when that is empty. `deps.listDir` is the
 * seam that lists that folder (see `uninstall`). */
export function forgetOptionalFile(home, file, deps = {}) {
  return forgetRecord(home, 'optional', (entry) => entry.path === file, deps.listDir);
}

/** The arrays of the manifest that hold what js-harness did only when asked, apart from what `install` writes. */
const ON_REQUEST = ['optional', 'tasks'];

/** Puts `record` in the array `key` of the manifest, in place of the one `matches` finds, creating the manifest
 * (with a `null` version: nothing is installed) when there is none. Returns the record. */
function keepRecord(home, key, record, matches) {
  const manifest = readManifest(home) ?? { version: null, files: [], entries: [] };
  const records = [...(manifest[key] ?? [])];
  const at = records.findIndex(matches);
  if (at === -1) records.push(record);
  else records[at] = record;
  writeManifest(home, { ...manifest, [key]: records });
  return record;
}

/** Takes the records `matches` finds out of the array `key`; `false` when there was none. An array left empty is
 * dropped, and a manifest that then records nothing at all (no version, no file, no entry, and nothing in any
 * array of `ON_REQUEST`) is removed, with its folder when that is empty and can be removed
 * (`removeEmptyDirsUpTo`, whose `listDir` this hands on). */
function forgetRecord(home, key, matches, listDir) {
  const manifest = readManifest(home);
  if (!manifest?.[key]?.some(matches)) return false;
  const left = manifest[key].filter((entry) => !matches(entry));
  const { [key]: dropped, ...rest } = manifest;
  const empty = rest.version === null && (rest.files ?? []).length === 0 && (rest.entries ?? []).length === 0
    && ON_REQUEST.every((other) => (rest[other] ?? []).length === 0);
  if (left.length > 0) {
    writeManifest(home, { ...manifest, [key]: left });
  } else if (empty) {
    fs.rmSync(manifestPath(home), { force: true });
    removeEmptyDirsUpTo(path.dirname(manifestPath(home)), home, listDir);
  } else {
    writeManifest(home, rest);
  }
  return true;
}

// ---- scheduled tasks --------------------------------------------------------------------------------------------------

/** Windows does not tell two task names apart by the case of their letters. */
export const sameTaskName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** Whether two tasks run the same thing: the program and its arguments, to the letter. `null` (a task that does
 * not run one command) is the same as nothing. */
export const sameTaskAction = (a, b) => Boolean(a && b) && a.command === b.command && a.arguments === b.arguments;

/** Scheduled tasks: a task js-harness registers with Windows only when asked (the watchdog of `remote start
 * --at-login`), kept in the manifest's `tasks` array as `{ name, command, arguments }`, apart from `optional`: a
 * task is not a file, and there are no bytes to hash. It is recorded by the command it runs because that is all
 * that can be compared later: `schtasks /Query /XML` gives a task back reordered, with defaults and the user's id
 * added (measured on 2026-10-06), so the document that registered it is never seen again.
 *
 * Like an optional file, no component declares one: `install` and `sync` carry the array forward as it is and
 * run nothing, a manifest that holds only such records has a `null` version and reads as not installed, and
 * `uninstall` deletes each task that still runs the recorded command (`removeScheduledTask`). Replaces any record
 * of that name. */
export function recordScheduledTask(home, task) {
  const record = { name: task.name, command: task.command, arguments: task.arguments };
  return keepRecord(home, 'tasks', record, (entry) => sameTaskName(entry.name, task.name));
}

/** Forgets the record of the task `name`, never touching the task itself; `false` when there was none. What is
 * left of the manifest is what `forgetOptionalFile` leaves: no empty `tasks`, and no manifest that records nothing.
 * `deps.listDir` is the same seam as there. */
export function forgetScheduledTask(home, name, deps = {}) {
  return forgetRecord(home, 'tasks', (entry) => sameTaskName(entry.name, name), deps.listDir);
}

/** Puts one record back as it was, for a command that takes back what it did: `record` (what the manifest held
 * for it before) is written again in place of what is there now, or, when there was none, what is there now is
 * forgotten. Only that one record is touched, in the manifest as it is at this moment: whatever another command
 * recorded meanwhile, for another project, stays. A record that is already as it was is not written again. */
function putRecordBack(home, key, matches, record) {
  const now = readManifest(home)?.[key]?.find(matches);
  if (!record) return now ? forgetRecord(home, key, matches) : false;
  if (now && deepEqual(now, record)) return false;
  keepRecord(home, key, record, matches);
  return true;
}

/** `putRecordBack` for the optional file at `file`, and for the scheduled task `name`. */
export const putOptionalRecordBack = (home, file, record) => putRecordBack(home, 'optional', (entry) => entry.path === file, record);
export const putTaskRecordBack = (home, name, record) => putRecordBack(home, 'tasks', (entry) => sameTaskName(entry.name, name), record);

/** `<SystemRoot>\System32`, from the `SystemRoot` (or `windir`) of `env` and nothing else, or `null` when `env`
 * does not give an absolute one: where Windows keeps `schtasks.exe` and `conhost.exe`. */
export function windowsSystem32(env) {
  const names = Object.keys(env);
  const key = names.find((name) => /^systemroot$/i.test(name)) ?? names.find((name) => /^windir$/i.test(name));
  const root = key === undefined ? '' : String(env[key]).trim();
  return path.win32.isAbsolute(root) ? path.win32.join(root, 'System32') : null;
}

/** Whether this process is a test: a file run by `node --test` (which sets `NODE_TEST_CONTEXT` for it), or a
 * test file run directly. */
const underTest = () => process.env.NODE_TEST_CONTEXT !== undefined || /\.test\.[cm]?js$/.test(process.argv[1] ?? '');

/** What `schtasks.exe` printed, as text: UTF-16 when it starts with that mark or reads as it, else one character
 * a byte. Only ASCII is ever compared, and that is the same either way. */
function printed(stdout) {
  if (!Buffer.isBuffer(stdout)) return String(stdout ?? '');
  if (stdout.length >= 2 && stdout[0] === 0xff && stdout[1] === 0xfe) return stdout.subarray(2).toString('utf16le');
  return stdout.length >= 2 && stdout[1] === 0 ? stdout.toString('utf16le') : stdout.toString('latin1');
}

/** Runs `schtasks.exe` with `args` and returns `{ status, stdout }`: the seam everything that registers, reads
 * or deletes a scheduled task goes through. The program is the one in the `System32` of the `SystemRoot` of `env`
 * (the environment the command was given), run with no shell; it is never looked for on `PATH`. Throws when `env`
 * names no such folder, and when the program could not run. Its messages come in the system's language, so
 * callers read the exit code and the XML and CSV it prints, never its words.
 *
 * It registers and deletes tasks on the machine it runs on, so a test never runs the real one: with no
 * `spawnSync` injected this refuses in a test process, and that comes first, before the environment is looked
 * at, so the refusal is the same on every host. */
export function runSchtasks(args, { env = process.env, spawnSync: sync } = {}) {
  if (sync === undefined && underTest()) throw new Error('the real schtasks.exe is never run from a test: this one has to hand in a fake');
  const system32 = windowsSystem32(env);
  if (!system32) throw new Error('SystemRoot is not set to an absolute folder in the environment, so schtasks.exe cannot be found: it is never looked for on PATH');
  // Half a minute at most: the command that waits holds its project's lock meanwhile. The list of every task, the
  // longest answer, took about a second and 23 KB on a machine with 217 of them (2026-10-06), far under the 1 MB
  // of output `spawnSync` takes by default, so that limit is left as it is.
  const result = (sync ?? spawnChildSync)(path.win32.join(system32, 'schtasks.exe'), args, { windowsHide: true, timeout: 30000 });
  if (result.error) throw new Error(`schtasks.exe could not run: ${result.error.message}`);
  return { status: result.status, stdout: printed(result.stdout) };
}

const XML_NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const xmlValue = (text) => text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, name) => {
  if (name[0] !== '#') return XML_NAMED[name] ?? whole;
  return String.fromCodePoint(/^#x/i.test(name) ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10));
});

/** What the task of the definition `xml` (what `schtasks /Query /TN <name> /XML` prints) runs: `{ command,
 * arguments }`, the two as they were registered, or `null` when it does not run exactly one command (no action,
 * several, or one of another kind): such a task is not one js-harness registered. */
export function scheduledTaskAction(xml) {
  const actions = /<Actions\b[^>]*>(.*?)<\/Actions>/s.exec(String(xml))?.[1];
  if (actions === undefined) return null;
  const commands = actions.match(/<Exec\b[^>]*>.*?<\/Exec>/gs) ?? [];
  if (commands.length !== 1 || actions.replace(commands[0], '').trim() !== '') return null;
  const value = (tag) => new RegExp(`<${tag}>(.*?)</${tag}>`, 's').exec(commands[0])?.[1];
  const command = value('Command');
  return command === undefined ? null : { command: xmlValue(command), arguments: xmlValue(value('Arguments') ?? '') };
}

/** Whether a task named `name` is registered (at the root of the task folders, where js-harness puts its own),
 * and what it runs: `{ found: 'absent' }`, `{ found: 'present', action }` (see `scheduledTaskAction`), or
 * `{ found: 'unknown', why }`. It only looks.
 *
 * `absent` has to be proven, because it is what lets a caller forget a record or register a task: the list of
 * every task ran (exit 0) and no row of it has that name. Asking for the task by name would not do: `schtasks`
 * fails the same way for a task that is not there and for a look that went wrong, and says which only in the
 * system's language. So the name is read from the list, where it is a literal, and only a task that is listed is
 * then asked for. Whatever else happens (the list failed, the task is listed and cannot be read, `schtasks`
 * could not run) is `unknown`. */
export function lookAtScheduledTask(name, schtasks) {
  try {
    const list = schtasks(['/Query', '/FO', 'CSV']);
    if (list.status !== 0) return { found: 'unknown', why: `the scheduled tasks could not be listed (schtasks /Query /FO CSV exited ${list.status})` };
    const listed = String(list.stdout).split(/\r?\n/).some((row) => sameTaskName(/^"((?:[^"]|"")*)"/.exec(row)?.[1] ?? '', `\\${name}`));
    if (!listed) return { found: 'absent' };
    const read = schtasks(['/Query', '/TN', name, '/XML']);
    if (read.status !== 0) return { found: 'unknown', why: `the task ${name} is listed and could not be read (schtasks /Query /TN ${name} /XML exited ${read.status})` };
    return { found: 'present', action: scheduledTaskAction(read.stdout) };
  } catch (err) {
    return { found: 'unknown', why: err.message };
  }
}

/** Deletes the task of the record `task` while it still runs the recorded command. Returns `{ status }`:
 * `removed`; `absent` when no such task is registered (its record is all there was); or `kept`, with `reason`:
 * `edited` (it runs something else now, so it is the user's), `unknown` (it could not be looked at, and nothing
 * is deleted on a guess) or `unremovable` (the delete failed), the last two with `why`. `look` is what
 * `lookAtScheduledTask` answered, when the caller already asked. */
export function removeScheduledTask(task, schtasks, look = lookAtScheduledTask(task.name, schtasks)) {
  if (look.found === 'unknown') return { status: 'kept', reason: 'unknown', why: look.why };
  if (look.found === 'absent') return { status: 'absent' };
  if (!sameTaskAction(look.action, task)) return { status: 'kept', reason: 'edited' };
  try {
    const deleted = schtasks(['/Delete', '/TN', task.name, '/F']);
    if (deleted.status !== 0) return { status: 'kept', reason: 'unremovable', why: `schtasks /Delete /TN ${task.name} /F exited ${deleted.status}` };
  } catch (err) {
    return { status: 'kept', reason: 'unremovable', why: err.message };
  }
  return { status: 'removed' };
}

/** Removes `dir` and any now-empty parent up to (but not including) `home`. Best effort: a folder that
 * cannot be listed is not known to be empty, and it is left, as is one that cannot be removed; the walk
 * ends there. It is the tidying after the caller's own work, which is done by then and must still be
 * reported: thrown from here, a failure took the result of `uninstall` with it (found in review,
 * 2026-10-10). `listDir` is the seam of its callers: `deps.listDir` of `uninstall`, `sync` and the two
 * that forget a record. */
function removeEmptyDirsUpTo(dir, home, listDir = fs.readdirSync) {
  let current = path.resolve(dir);
  const stop = path.resolve(home);
  while (current !== stop && current.startsWith(stop)) {
    try {
      if (!fs.existsSync(current) || listDir(current).length > 0) break;
      fs.rmdirSync(current);
    } catch {
      break;
    }
    current = path.dirname(current);
  }
}

/** Writes every component for `version`, grafts every entry component, and records the resulting
 * manifest. Reads any previous manifest first (still on disk, since `writeManifest` below is the
 * last thing this does) so entry `createdFile` flags survive a repeat install — see
 * `installEntries`. `deps.writeFile` (default `fs.writeFileSync`) is an injectable seam so tests can
 * force a component write to fail without depending on real file permissions (chmod is unreliable
 * on Windows). R3-002 (accepted T4 review follow-up): a component whose host directory cannot be
 * reached (e.g. `.claude`/`.codex` is itself a plain file) is left out of `files` for this run
 * rather than throwing out of install/sync — the manifest still records whatever else was actually
 * written, and a later, healthy run picks the missing component back up. R3-001 (accepted final
 * review follow-up, lineage review-cef5637e2884c12a): when the previous manifest already had a
 * record for that same target, that record is carried forward instead of dropped — marked
 * `skipped: true` with the failure's `reason` — so a file js-harness already wrote is never
 * orphaned: uninstall can still find and remove it (see `uninstall` below, unchanged: it already
 * compares the real file's sha256 against whatever record it is handed), and `sync`'s pruning
 * (below) never mistakes a merely-failed rewrite for a component that is no longer shipped. */
export function install(home, version, deps = {}) {
  const writeFile = deps.writeFile ?? fs.writeFileSync;
  const previous = readManifest(home);
  const files = [];
  for (const component of components) {
    const target = component.target(home);
    const content = component.content(version);
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      writeFile(target, content, 'utf8');
      files.push({ path: target, sha256: sha256(content), skipped: false });
    } catch (err) {
      const previousRecord = previous?.files?.find((f) => f.path === target);
      if (previousRecord) {
        files.push({ path: previousRecord.path, sha256: previousRecord.sha256, skipped: true, reason: err.message });
      }
      // else: never installed before, so there is nothing to carry forward or report as orphaned.
    }
  }
  const entries = installEntries(home, previous);
  // Optional files and scheduled tasks are carried forward as recorded (see `recordOptionalFile` and
  // `recordScheduledTask`): nothing here writes, registers or drops one.
  const carried = Object.fromEntries(ON_REQUEST.filter((key) => previous?.[key]).map((key) => [key, previous[key]]));
  const manifest = { version, files, entries, ...carried };
  writeManifest(home, manifest);
  return manifest;
}

/** Re-writes components for `version`, drops files and entries the current release no longer
 * ships, and updates the manifest. An old manifest with no `entries` field (written before T4)
 * still loads: pruning simply has nothing to prune. `deps` is forwarded to `install` (see its
 * `deps.writeFile` seam above), and `deps.listDir` is the seam that lists the folder a pruned file
 * leaves behind (see `uninstall`). */
export function sync(home, version, deps = {}) {
  const previous = readManifest(home);
  const manifest = install(home, version, deps);

  if (previous) {
    // R3-001 (accepted final review follow-up, lineage review-cef5637e2884c12a): prune a file only
    // when its component is no longer *declared* at all — compared against `components`' own
    // current targets, not against this run's successful writes — so a component that is still
    // declared but merely failed to (re)write this run (carried forward above with `skipped: true`)
    // is never treated as "no longer shipped" and deleted.
    const declaredTargets = new Set(components.map((c) => c.target(home)));
    for (const file of previous.files) {
      if (declaredTargets.has(file.path)) continue;
      if (fs.existsSync(file.path)) {
        fs.rmSync(file.path);
        removeEmptyDirsUpTo(path.dirname(file.path), home, deps.listDir);
      }
    }

    const keptEntries = manifest.entries ?? [];
    for (const entry of previous.entries ?? []) {
      if (entry.skipped) continue;
      const stillDeclared = keptEntries.some(
        (e) => e.path === entry.path && deepEqual(e.pointer, entry.pointer) && deepEqual(e.entry, entry.entry),
      );
      if (stillDeclared) continue;
      removeEntryFromFile(entry.path, entry.pointer, entry.entry, entry.createdFile, entry.createdContainers, pointersIn(previous.entries, entry.path));
    }
  }

  return manifest;
}

/** Deletes manifest files whose content is untouched; keeps and reports edited ones, optional files
 * included (reported in the same two lists). Removes each
 * recorded entry the same way (deep-equal match only, file left alone otherwise — see
 * `removeEntryFromFile`), then the doctor cache (js-harness's own runtime cache, never part of
 * `files`/`entries` since it is not "installed content"), the folder of the machine's gate lock, and
 * finally the manifest itself.
 *
 * The gate lock's folder is written by `check` and `gate`, not by `install`, so it is looked for under a
 * home with no manifest as well, which is otherwise left as it is. Its path is in `removed` when it was
 * there and is gone, and `gateKept` says why it was left, as `[{ path, reason, ... }]`: `in-use` with the
 * `pid` and `cwd` of the gate that is alive in it, or `unremovable` with the error's `code`, for a folder
 * that could not be looked at as for one that could not be removed (`removeGateFolder`).
 * `deps.statFile` (default `fs.statSync`) is the seam that looks for that folder, and `deps.listDir`
 * (default `fs.readdirSync`) the one that lists a folder left behind to see whether it is empty and goes
 * too (`removeEmptyDirsUpTo`, which leaves one it cannot list): a test makes either fail as the system
 * does for what it gives no access to.
 *
 * The gate log is the gates' other folder, beside the lock's, and no gate ever removes it: it is looked for
 * with a manifest and without, removed whole through the same seams and named in `removed`
 * (`removeGateLogFolder`). It goes or stays with the lock's folder. While that one is kept `in-use` the log
 * is kept too, since the gate that is alive has yet to write its end in it, and the same entry of `gateKept`
 * names it, as `log`: one thing is kept, for one reason, and is said once. It is kept the same way, in the
 * `unremovable` entry of a lock's folder that could not be looked at, since nobody then knows whether a gate
 * is alive; beside one that was looked at and could not be removed, it goes. A log that could not be looked
 * at or removed is an entry of `gateKept` of its own, `{ path, reason: 'unremovable', code }`.
 *
 * The folder of the session channel is the same case: `notify` writes it, not `install`, so it is looked
 * for with a manifest and without, removed with what it holds through the same seams, named in `removed`,
 * and `channelKept` says why it was left, as `[{ path, reason: 'unremovable', code }]`
 * (`removeChannelFolder`). The orchestrator's relief file is not part of it and stays.
 *
 * `keptOptional` says why each optional file in `kept` is there, as `{ path, reason }`: `edited` (its bytes are
 * no longer what was recorded), or `unreadable` or `unremovable` with the `code` of the error that stopped it.
 * The last two are not the user's doing, and the manifest that named the file is gone when this returns, so
 * the caller has to say that the file is left for the human to remove. `deps.removeFile` (default `fs.rmSync`)
 * is the seam that removes a component or an optional file, so a test can make a removal fail without relying
 * on file permissions (the same reason as `install`'s `deps.writeFile`).
 *
 * A recorded scheduled task is deleted only while it still runs the recorded command (`removeScheduledTask`):
 * `tasksRemoved` names those, and `tasksKept` says why each other one that is still registered was left, as
 * `{ name, reason, why }`: `edited`, or `unknown` or `unremovable` with `why`. A task that is already gone just
 * loses its record. `deps.schtasks` (default `runSchtasks`, which refuses in a test) is the seam, and it is run
 * only for a manifest that records a task.
 *
 * A task kept as `edited` is the user's now, and its record goes with the rest. One kept as `unknown` or
 * `unremovable` is not: it is still registered, or may be, and it fires every five minutes and starts the server
 * again. So its record stays, alone, in a manifest with a `null` version (which reads as not installed, as the one
 * `recordScheduledTask` creates), and `uninstall`, or `remote stop --at-login`, can be run again. An optional file
 * that could not be removed has no such second chance: that older gap is left as it is. */
export function uninstall(home, deps = {}) {
  const removeFile = deps.removeFile ?? fs.rmSync;
  const statFile = deps.statFile ?? fs.statSync;
  const listDir = deps.listDir ?? fs.readdirSync;
  const manifest = readManifest(home);
  if (!manifest) {
    // No install to undo, and still a home `check` may have run under: the gate lock's folder is no
    // component, and neither is the log of the gates, so they are looked for all the same, and the folder
    // they leave empty goes with them.
    const gate = removeGateFolder(home, removeFile, statFile);
    const log = removeGateLogFolder(home, removeFile, statFile, gate.kept, gate.unseen);
    const channel = removeChannelFolder(home, removeFile, statFile);
    removeEmptyDirsUpTo(path.dirname(gateDir(home)), home, listDir);
    return { removed: [...gate.removed, ...log.removed, ...channel.removed], kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: log.gateKept, channelKept: channel.kept };
  }

  const removed = [];
  const kept = [];
  for (const file of manifest.files) {
    if (!fs.existsSync(file.path)) continue;
    const current = fs.readFileSync(file.path, 'utf8');
    if (sha256(current) === file.sha256) {
      removeFile(file.path);
      removeEmptyDirsUpTo(path.dirname(file.path), home, listDir);
      removed.push(file.path);
    } else {
      kept.push(file.path);
    }
  }

  // Optional files, compared by their bytes (a launcher need not be UTF-8). Their folder is left even when
  // empty: it is the system's (the Windows Startup folder), not one install made. One that cannot be read or
  // removed (locked, or a folder at the recorded path) is kept, with the reason: the components above are
  // already gone, so stopping here would leave a manifest that names files that no longer exist.
  const keptOptional = [];
  for (const file of manifest.optional ?? []) {
    if (!fs.existsSync(file.path)) continue;
    const why = keepOptionalFile(file, removeFile);
    if (!why) {
      removed.push(file.path);
      continue;
    }
    kept.push(file.path);
    keptOptional.push({ path: file.path, ...why });
  }

  const entriesRemoved = [];
  const entriesKept = [];
  for (const entry of manifest.entries ?? []) {
    if (entry.skipped) continue;
    const result = removeEntryFromFile(entry.path, entry.pointer, entry.entry, entry.createdFile, entry.createdContainers, pointersIn(manifest.entries, entry.path));
    if (result.status === 'removed') entriesRemoved.push(entry.path);
    else if (result.status === 'kept') entriesKept.push(entry.path);
  }

  const tasksRemoved = [];
  const tasksKept = [];
  const stillRecorded = [];
  for (const task of manifest.tasks ?? []) {
    const result = removeScheduledTask(task, deps.schtasks ?? runSchtasks);
    if (result.status === 'removed') tasksRemoved.push(task.name);
    else if (result.status === 'kept') tasksKept.push({ name: task.name, reason: result.reason, ...(result.why ? { why: result.why } : {}) });
    if (result.status === 'kept' && result.reason !== 'edited') stillRecorded.push(task);
  }

  fs.rmSync(cachePath(home), { force: true });
  const gate = removeGateFolder(home, removeFile, statFile);
  const log = removeGateLogFolder(home, removeFile, statFile, gate.kept, gate.unseen);
  const channel = removeChannelFolder(home, removeFile, statFile);
  removed.push(...gate.removed, ...log.removed, ...channel.removed);
  if (stillRecorded.length > 0) {
    writeManifest(home, { version: null, files: [], entries: [], tasks: stillRecorded });
  } else {
    fs.rmSync(manifestPath(home), { force: true });
    removeEmptyDirsUpTo(path.dirname(manifestPath(home)), home, listDir);
  }

  return { removed, kept, keptOptional, entriesRemoved, entriesKept, tasksRemoved, tasksKept, gateKept: log.gateKept, channelKept: channel.kept };
}

/** Removes the folder of the machine's gate lock under `home` (`gateDir` of `gate-lock.mjs`) with whatever
 * is in it, as `{ removed, kept }`: `removed` holds its path when it was there and is gone, `kept` says
 * why it was left, as `{ path, reason, ... }`, and both are empty when there was no such folder.
 *
 * Nothing records that folder: `check` and `js-harness gate` write it under the home, a gate that ends
 * removes its own files and the folder with them, and what is found here is what a gate that was killed
 * left, or the empty folder an older version left after every gate. It is not removed from under a gate
 * that is alive, which would take its lock away: while a gate holds the lock and still beats, or waits
 * for it, the folder is kept with reason `in-use` and that gate's `pid` and `cwd`, and the gate removes it
 * when it ends. A holder that stopped beating a minute ago is no live gate. One that started in the
 * instant between this look and the removal loses its lock, and its own report says so.
 *
 * A folder that could not be looked at or removed is kept with reason `unremovable` and the error's
 * `code`. The two are one to whoever reads `kept`, and not to the gate log (`removeGateLogFolder`): a
 * folder that was looked at and then not removed holds no live gate, and of one that could not be looked
 * at nobody knows. So the answer also has `unseen: true` for that second one, the folder itself or the
 * gates in it. `removeFile` and `statFile` are `uninstall`'s own seams. */
function removeGateFolder(home, removeFile, statFile) {
  const dir = gateDir(home);
  const unremovable = (err) => ({ path: dir, reason: 'unremovable', code: err.code ?? 'unknown error' });
  let alive;
  try {
    if (!isThere(dir, statFile)) return { removed: [], kept: [] };
    // The waiters first, as the session board reads them: a gate that takes the lock between the two
    // reads is then in one of them.
    const [waiting] = readGateWaiters(home);
    const holder = readGateHolder(home);
    alive = holder && !holder.stale ? holder : waiting;
  } catch (err) {
    return { removed: [], kept: [unremovable(err)], unseen: true };
  }
  if (alive) return { removed: [], kept: [{ path: dir, reason: 'in-use', pid: alive.pid, cwd: alive.cwd }] };
  try {
    removeFile(dir, { recursive: true, force: true });
  } catch (err) {
    return { removed: [], kept: [unremovable(err)] };
  }
  return { removed: [dir], kept: [] };
}

/** Removes the folder of the gate log under `home` (`gateLogDir` of `gate-log.mjs`) with the two files it
 * can hold, as `{ removed, gateKept }`: `removed` holds its path when it was there and is gone, and
 * `gateKept` is what `uninstall` says of the gates' folders that are left, the `gateKept` it is handed
 * (what `removeGateFolder` kept of the lock's folder) with the log said in it.
 *
 * Nothing records that folder: `check` and `js-harness gate` append to it under the home, in a project
 * with a machine install or without one, and unlike the lock's files no gate removes what it wrote there.
 * It is kept for a gate that is alive, or that may be, and for nothing else. Such a gate has yet to write its end, and the
 * writer makes the folder again: a log removed under it would be back when it ends, holding half a gate,
 * after `uninstall` said it was gone. So when the lock's folder was kept `in-use`, the log stays and that
 * entry names it as `log`; the next `uninstall` removes it. The lock's folder says whether a gate is alive,
 * which is why this is asked of what was kept of it and not looked for again. A gate that runs without the
 * lock is not seen there: its end makes the folder again, as a notice does to the channel's, and the next
 * `uninstall` removes it.
 *
 * `lockUnseen` says that the lock's folder could not be looked at (`unseen` of `removeGateFolder`). Nobody
 * then knows whether a gate is alive, and the log is kept as for one that is, named as `log` in the entry
 * of the lock's folder, which is `unremovable`: a first version removed it, and a gate that was alive wrote
 * its end into a folder made again, without its start (found in review, 2026-10-11). A lock's folder that
 * was looked at, holds no live gate and then could not be removed is `unremovable` too and keeps no log.
 *
 * A folder that could not be looked at or removed is kept with reason `unremovable` and the error's
 * `code`, in an entry of its own, beside a live gate as well: it is not said to be kept for that gate on a
 * guess. `removeFile` and `statFile` are `uninstall`'s own seams. */
function removeGateLogFolder(home, removeFile, statFile, gateKept, lockUnseen = false) {
  const dir = gateLogDir(home);
  try {
    if (!isThere(dir, statFile)) return { removed: [], gateKept };
    // The entry of the lock's folder the log is kept with: there is one at most.
    const keepsLog = (kept) => kept.reason === 'in-use' || lockUnseen;
    if (gateKept.some(keepsLog)) {
      return { removed: [], gateKept: gateKept.map((kept) => (keepsLog(kept) ? { ...kept, log: dir } : kept)) };
    }
    removeFile(dir, { recursive: true, force: true });
  } catch (err) {
    return { removed: [], gateKept: [...gateKept, { path: dir, reason: 'unremovable', code: err.code ?? 'unknown error' }] };
  }
  return { removed: [dir], gateKept };
}

/** Removes the folder of the session channel under `home` (`channelDir` of `channel.mjs`) with whatever is
 * in it, the record of every project and the openings of their sessions, as `{ removed, kept }`, like
 * `removeGateFolder`: `removed` holds its path when it was there and is gone, `kept` says why it was left,
 * and both are empty when there was no such folder.
 *
 * Nothing records that folder either: `js-harness notify` writes it under the home, in a project with a
 * machine install or without one. No process lives in it, so there is no "in use": a notice appended
 * while it goes makes the folder again, and the next `uninstall` removes it. A folder that could not be
 * looked at or removed is kept with reason `unremovable` and the error's `code`.
 *
 * The orchestrator's relief file is beside it and is not touched: it is that session's own log, written by
 * hand before `notify --relief` existed, and no `uninstall` ever removed it. */
function removeChannelFolder(home, removeFile, statFile) {
  const dir = channelDir(home);
  try {
    if (!isThere(dir, statFile)) return { removed: [], kept: [] };
    removeFile(dir, { recursive: true, force: true });
  } catch (err) {
    return { removed: [], kept: [{ path: dir, reason: 'unremovable', code: err.code ?? 'unknown error' }] };
  }
  return { removed: [dir], kept: [] };
}

/** Whether something is at `target`: `false` only when the system says nothing is (ENOENT, or ENOTDIR for
 * a parent that is a file). Throws when it could not be looked at (no access to it), which `existsSync`
 * answers as not there. */
function isThere(target, statFile) {
  try {
    statFile(target);
    return true;
  } catch (err) {
    if (['ENOENT', 'ENOTDIR'].includes(err.code)) return false;
    throw err;
  }
}

/** Removes the optional file of the record `file` when its bytes are still what was recorded. Returns nothing
 * once it is removed, else why it is kept: `{ reason }`, with the error's `code` when an error is the reason. */
function keepOptionalFile(file, removeFile) {
  let bytes;
  try {
    bytes = fs.readFileSync(file.path);
  } catch (err) {
    return { reason: 'unreadable', code: err.code ?? 'unknown error' };
  }
  if (sha256(bytes) !== file.sha256) return { reason: 'edited' };
  try {
    removeFile(file.path);
  } catch (err) {
    return { reason: 'unremovable', code: err.code ?? 'unknown error' };
  }
  return undefined;
}
