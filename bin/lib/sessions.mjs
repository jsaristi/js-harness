// Pure facts for `bin/sessions.mjs` — see odd/tasks/session-board.md (## Design records the transcript
// format this file reads, established from real transcripts). No fs and no process here: a transcript's
// text goes in and session facts come out, and every external command is a `run` the caller hands in,
// so the tests use inline synthetic transcripts and fake commands, never this machine's sessions.
import { parseSnapshot } from './process-tree.mjs';

const TITLE_LENGTH = 60;
const NOTIFICATION_PATTERN = /<task-notification>([\s\S]*?)<\/task-notification>/g;

/** A transcript's entries, one JSON object per line. A line that does not parse is skipped and counted,
 * never fatal: a session appends to its transcript while the board reads it, so the last line may be
 * half written. */
export function parseTranscript(text) {
  const entries = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      skipped += 1;
    }
  }
  return { entries, skipped };
}

/** The text of one tag of a notification block, or `undefined` when the block has no such tag. */
function tagOf(block, name) {
  return new RegExp(`<${name}>([^<]*)</${name}>`).exec(block)?.[1].trim();
}

/** The task notifications `entry` delivers, as `{ task, toolUse, status }`. A notification reaches a
 * transcript in three forms: a user entry whose content is the notification, a `queue-operation` entry
 * that holds it while the session is busy, and a `queued_command` attachment when it was absorbed
 * mid-turn. Only text that *starts* with the notification counts, so one quoted inside a prompt, or
 * echoed by a hook, is never read as an end. */
function notificationsOf(entry) {
  let text = null;
  if (entry.type === 'user') text = entry.message?.content;
  else if (entry.type === 'queue-operation') text = entry.content;
  else if (entry.type === 'attachment' && entry.attachment?.type === 'queued_command') text = entry.attachment.prompt;
  if (typeof text !== 'string' || !text.trimStart().startsWith('<task-notification>')) return [];
  return [...text.matchAll(NOTIFICATION_PATTERN)].map(([, block]) => ({
    task: tagOf(block, 'task-id'),
    toolUse: tagOf(block, 'tool-use-id'),
    status: tagOf(block, 'status'),
  }));
}

/** A user entry's text when somebody typed it: not a meta entry, not a compaction summary, not a
 * notification or a command wrapper (those start with a tag). `null` otherwise. */
function promptText(entry) {
  if (entry.type !== 'user' || entry.isMeta || entry.isCompactSummary) return null;
  const content = entry.message?.content;
  const text = typeof content === 'string' ? content : Array.isArray(content) ? content.find((block) => block.type === 'text')?.text : null;
  if (typeof text !== 'string' || text.trimStart().startsWith('<') || text.startsWith('[Request interrupted')) return null;
  return text;
}

function oneLine(text) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > TITLE_LENGTH ? `${flat.slice(0, TITLE_LENGTH)}…` : flat;
}

/** What one entry says about the turn: `'working'` (a tool call, a tool result, a prompt or a
 * notification the session has not answered yet, a message still being written), `'ended'` (a reply
 * that closes its message, an interruption, the output of a local command, a compaction summary), or
 * `null` when the entry does not take part (meta entries, side chains, everything that is neither a user
 * nor an assistant entry). */
function turnOf(entry) {
  if (entry.isSidechain || entry.isMeta) return null;
  const content = entry.message?.content;
  if (entry.type === 'assistant') {
    const blocks = Array.isArray(content) ? content : [];
    if (blocks.some((block) => block.type === 'tool_use')) return 'working';
    // Every block of a message is its own entry and all of them carry the message's stop reason, so a
    // text block closes the turn only when the message did not stop to call a tool.
    return blocks.some((block) => block.type === 'text') && entry.message.stop_reason !== 'tool_use' ? 'ended' : 'working';
  }
  if (entry.type !== 'user') return null;
  if (entry.isCompactSummary) return 'ended';
  if (typeof content === 'string') return content.trimStart().startsWith('<local-command-stdout>') ? 'ended' : 'working';
  if (!Array.isArray(content)) return null;
  if (content.some((block) => block.type === 'tool_result')) return 'working';
  return content.some((block) => block.type === 'text' && block.text.startsWith('[Request interrupted')) ? 'ended' : 'working';
}

const isAgent = (name) => name === 'Agent' || name === 'Task';

function newWork(block, entry, mode) {
  return {
    tool: isAgent(block.name) ? 'Agent' : block.name,
    kind: block.input?.subagent_type ?? null,
    toolUseId: block.id,
    id: null,
    description: block.input?.description ?? null,
    launchedAt: entry.timestamp ?? null,
    mode,
    ended: false,
    endedAt: null,
    status: null,
  };
}

function end(work, at, status) {
  if (work.ended) return; // the first recorded end wins: the same notification is written more than once
  work.ended = true;
  work.endedAt = at ?? null;
  work.status = status;
}

/** One session's facts from its transcript's text: `title` and where it came from, `lastEntryAt`, the
 * `cwd` and `gitBranch` its last entry records, its background `work` with each recorded end, the `state`
 * derived from those, the `tail` of its last reply (`tail` lines, default 3) and the lines skipped.
 *
 * Work is every `Agent` call and every `Bash` call that went to the background. Its id (the task id of
 * a shell, the agent id of a subagent) comes from the tool result that follows the call, never from the
 * call itself, so work whose result is not written yet has `id: null`. A foreground `Agent` call ends
 * with its tool result; everything else ends with a task notification that carries a status. */
export function sessionFacts(text, { tail = 3 } = {}) {
  const { entries, skipped } = parseTranscript(text);
  const calls = new Map(); // tool_use id -> the tool_use block and the entry that holds it
  const workByCall = new Map(); // tool_use id -> work, in launch order
  let customTitle = null;
  let firstPrompt = null;
  let lastEntryAt = null;
  let cwd = null;
  let gitBranch = null;
  let turn = null;
  let lastReply = null;

  for (const entry of entries) {
    if (entry.type === 'custom-title' && typeof entry.customTitle === 'string') customTitle = entry.customTitle;
    if (typeof entry.timestamp === 'string' && (lastEntryAt === null || entry.timestamp > lastEntryAt)) lastEntryAt = entry.timestamp;
    if (typeof entry.cwd === 'string') cwd = entry.cwd;
    if (typeof entry.gitBranch === 'string') gitBranch = entry.gitBranch;
    firstPrompt ??= promptText(entry);
    turn = turnOf(entry) ?? turn;

    for (const { task, toolUse, status } of notificationsOf(entry)) {
      if (status === undefined) continue; // an event of a task that is still running
      const at = entry.timestamp ?? entry.attachment?.timestamp;
      for (const work of workByCall.values()) {
        if ((task !== undefined && work.id === task) || (toolUse !== undefined && work.toolUseId === toolUse)) end(work, at, status);
      }
    }
    if (entry.isSidechain || !Array.isArray(entry.message?.content)) continue;

    for (const block of entry.message.content) {
      if (entry.type === 'assistant' && block.type === 'text' && block.text.trim() !== '') lastReply = block.text;
      // A resumed session writes earlier entries again: only the first sight of a call launches work, so
      // a repeated call never reopens work whose end was recorded in between.
      if (entry.type === 'assistant' && block.type === 'tool_use' && !calls.has(block.id)) {
        calls.set(block.id, { block, entry });
        if (isAgent(block.name)) workByCall.set(block.id, newWork(block, entry, block.input?.run_in_background === true ? 'background' : 'foreground'));
        else if (block.name === 'Bash' && block.input?.run_in_background === true) workByCall.set(block.id, newWork(block, entry, 'background'));
      }
      if (entry.type !== 'user' || block.type !== 'tool_result' || !calls.has(block.tool_use_id)) continue;
      const launch = calls.get(block.tool_use_id);
      const outcome = entry.toolUseResult !== null && typeof entry.toolUseResult === 'object' && !Array.isArray(entry.toolUseResult) ? entry.toolUseResult : {};
      let work = workByCall.get(block.tool_use_id);
      if (typeof outcome.backgroundTaskId === 'string') {
        // Also a call that never asked for the background: one that outlived its timeout is moved there.
        if (!work) workByCall.set(block.tool_use_id, (work = newWork(launch.block, launch.entry, 'background')));
        work.id = outcome.backgroundTaskId;
      } else if (work && outcome.isAsync === true) {
        work.id = outcome.agentId ?? null;
        work.mode = 'background';
      } else if (work) {
        work.id = outcome.agentId ?? null;
        end(work, entry.timestamp, block.is_error === true ? 'error' : (outcome.status ?? 'returned'));
      }
    }
  }

  const work = [...workByCall.values()];
  const facts = {
    title: customTitle ?? (firstPrompt === null ? null : oneLine(firstPrompt)),
    titleSource: customTitle !== null ? 'custom-title' : firstPrompt !== null ? 'first-prompt' : null,
    lastEntryAt,
    cwd,
    gitBranch,
    state: turn === null ? 'unknown' : turn === 'working' ? 'working' : work.some((item) => !item.ended) ? 'background' : 'waiting',
    work,
    tail: tail > 0 && lastReply !== null ? lastReply.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.trim() !== '').slice(-tail) : [],
    skippedLines: skipped,
  };
  if (turn === null) facts.stateReason = 'the transcript holds no prompt, reply or tool entry';
  return facts;
}

// ---- machine facts ------------------------------------------------------------------------------------
//
// Each fact below is read through a `run(command, args, { cwd })` that returns what `spawnSync` returns
// (`status`, `stdout`, `stderr`, `error`). A fact that cannot be read is `{ available: false, reason }`
// for a whole list, or `{ unavailable: reason }` for one value of an item: never left out, never guessed.

/** The folder name Claude Code keeps a project's sessions under: the project's absolute path with every
 * character outside `[A-Za-z0-9]` turned into `-` (`D:\js-harness` is `D--js-harness`). */
export function projectSlug(root) {
  return root.replace(/[^A-Za-z0-9]/g, '-');
}

const failed = (result) => Boolean(result.error) || result.status !== 0;

/** Why a command failed, in one line: that it is not installed, what the system said when it could not
 * be started, the first line it wrote to stderr, or its exit code when it wrote nothing. */
function failure(command, result) {
  if (result.error) return result.error.code === 'ENOENT' ? `${command} is not installed or not on PATH` : result.error.message;
  return String(result.stderr ?? '').trim().split(/\r?\n/)[0] || `exit ${result.status}`;
}

/** The entries of `git worktree list --porcelain`: `{ path, head, branch, bare }`, `branch` without its
 * `refs/heads/` and `null` for a detached or bare entry. */
export function parseWorktreeList(porcelain) {
  const trees = [];
  for (const line of porcelain.split(/\r?\n/)) {
    const [key, ...rest] = line.split(' ');
    const value = rest.join(' ');
    if (key === 'worktree') trees.push({ path: value, head: null, branch: null, bare: false });
    else if (trees.length === 0) continue;
    else if (key === 'HEAD') trees.at(-1).head = value;
    else if (key === 'branch') trees.at(-1).branch = value.replace(/^refs\/heads\//, '');
    else if (key === 'bare') trees.at(-1).bare = true;
  }
  return trees;
}

/** One count git prints for a worktree, or why it could not be read. */
function gitCount(run, cwd, args, parse = (stdout) => Number(stdout.trim())) {
  const what = `git ${args.find((arg) => !arg.startsWith('-'))}`;
  const result = run('git', args, { cwd });
  if (failed(result)) return { failed: result, unavailable: `${what}: ${failure('git', result)}` };
  const value = parse(result.stdout);
  if (!Number.isInteger(value)) return { unavailable: `${what}: printed ${JSON.stringify(result.stdout.trim())}, not a count` };
  return value;
}

/** Every worktree of the repository at `root`: `path`, `branch`, `head`, `aheadOfMain` (commits not on
 * `origin/main`), `aheadOfUpstream` (commits not on its upstream, or `'no upstream'`) and `changed`
 * (files `git status` lists). The status is read with `--no-optional-locks`, so the board never holds
 * the index lock a session committing in that worktree needs. */
export function readWorktrees(run, root) {
  const listed = run('git', ['worktree', 'list', '--porcelain'], { cwd: root });
  if (failed(listed)) return { available: false, reason: `git worktree: ${failure('git', listed)}` };
  const items = parseWorktreeList(listed.stdout).map((tree) => {
    if (tree.bare) {
      const none = { unavailable: 'a bare repository has no checkout' };
      return { ...tree, aheadOfMain: none, aheadOfUpstream: none, changed: none };
    }
    const aheadOfMain = gitCount(run, tree.path, ['rev-list', '--count', 'origin/main..HEAD']);
    let aheadOfUpstream = gitCount(run, tree.path, ['rev-list', '--count', '@{upstream}..HEAD']);
    // A branch that was never pushed and a detached HEAD have no upstream: that is an answer, not a failure.
    if (aheadOfUpstream.failed && /no upstream|does not point to a branch/i.test(String(aheadOfUpstream.failed.stderr))) aheadOfUpstream = 'no upstream';
    const changed = gitCount(run, tree.path, ['--no-optional-locks', 'status', '--porcelain'], (stdout) => stdout.split(/\r?\n/).filter((line) => line !== '').length);
    const fact = (value) => (value?.unavailable ? { unavailable: value.unavailable } : value);
    return { ...tree, aheadOfMain: fact(aheadOfMain), aheadOfUpstream: fact(aheadOfUpstream), changed: fact(changed) };
  });
  return { available: true, items };
}

/** `[{ pid, createdAt, commandLine }]` from what the Windows listing of `bin/sessions.mjs` prints: a row
 * of the shared process listing per process (`parseSnapshot` of `bin/lib/process-tree.mjs`), a line
 * `C<TAB>pid<TAB>command line` for it, and `OK<TAB>count` at the very end. Throws without that last
 * line: "no gate is running" must never be read from a listing that stopped half way. */
export function parseProcessList(stdout) {
  if (!/^OK\t\d+\r?$/m.test(stdout)) throw new Error('the listing did not finish');
  const createdAt = new Map(parseSnapshot(stdout).map((row) => [row.pid, row.createdAt]));
  return stdout
    .split(/\r?\n/)
    .map((line) => /^C\t(\d+)\t(.*)$/.exec(line))
    .filter(Boolean)
    .map((match) => ({ pid: Number(match[1]), createdAt: createdAt.get(Number(match[1])) ?? null, commandLine: match[2] }));
}

/** The same list from `ps -A -o pid=,args=`, which gives no start time. */
export function parsePsList(stdout) {
  return stdout
    .split(/\r?\n/)
    .map((line) => /^\s*(\d+)\s+(.*)$/.exec(line))
    .filter(Boolean)
    .map((match) => ({ pid: Number(match[1]), createdAt: null, commandLine: match[2].trim() }));
}

// One argument, quoted or bare, that is `bin/check.mjs` or ends in it after a separator (`sbin/check.mjs`
// is another file). The folder before it, when there is one, is the first or the second group.
const GATE_PATTERN = /(?:"(?:([^"]*)[\\/])?bin[\\/]check\.mjs"|(?<=^|\s)(?:(\S*)[\\/])?bin[\\/]check\.mjs(?=\s|$))/;

/** A path as two spellings of it compare: forward slashes, no trailing one, and no case on a drive path. */
function comparable(somePath) {
  const flat = somePath.replace(/\\/g, '/').replace(/\/+$/, '');
  return /^[A-Za-z]:/.test(flat) ? flat.toLowerCase() : flat;
}

/** The running gates among `processes`: every process whose program is `node` and whose command line
 * names `bin/check.mjs` as an argument. A shell whose text mentions the file is not one, and neither is
 * `bin/check.test.mjs`. `worktree` is the folder the command line names the file under (in the
 * spelling of `worktrees` when it is one of them); a relative path names none, and a process has no
 * working directory the listing could read instead. */
export function findGates(processes, worktrees = []) {
  const gates = [];
  for (const { pid, createdAt, commandLine } of processes) {
    const program = /^\s*(?:"([^"]+)"|(\S+))/.exec(commandLine);
    if (!program || !/(^|[\\/])node(\.exe)?$/i.test(program[1] ?? program[2])) continue;
    const named = GATE_PATTERN.exec(commandLine.slice(program[0].length));
    if (!named) continue;
    const folder = named[1] ?? named[2] ?? '';
    const known = worktrees.find((tree) => comparable(tree) === comparable(folder));
    gates.push({
      pid,
      startedAt: Number.isFinite(createdAt) ? new Date(createdAt).toISOString() : { unavailable: 'the process listing gave no start time' },
      worktree: /^([A-Za-z]:|[\\/])/.test(folder) ? (known ?? folder) : { unavailable: 'its command line names bin/check.mjs by a relative path' },
      commandLine,
    });
  }
  return gates;
}

/** The running gates, from `listProcesses()` (which throws when it could not look). */
export function readGates(listProcesses, worktrees = []) {
  try {
    return { available: true, items: findGates(listProcesses(), worktrees) };
  } catch (err) {
    return { available: false, reason: `the process listing: ${err.message}` };
  }
}

/** The repository's open pull requests, `{ number, title, branch }`, from `gh pr list`. */
export function readPullRequests(run, root) {
  const listed = run('gh', ['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,headRefName'], { cwd: root });
  if (failed(listed)) return { available: false, reason: `gh pr: ${failure('gh', listed)}` };
  try {
    const items = JSON.parse(listed.stdout).map(({ number, title, headRefName }) => ({ number, title, branch: headRefName }));
    return { available: true, items };
  } catch {
    return { available: false, reason: 'gh pr: its output is not the JSON list it was asked for' };
  }
}

// ---- the board as text --------------------------------------------------------------------------------

const TAIL_WIDTH = 160;

/** The board's last line: what no fact on disk tells it, so nobody reads its silence as "nothing there". */
export const NOT_VISIBLE =
  'Not visible from here: what a session plans to do next, work it started outside its transcript (a subagent\'s own background commands, a terminal), and sessions opened from another folder.';

/** How long ago `iso` was, seen from `now` (ms): `45s ago`, `12m ago`, `2h 05m ago`, `3d ago`. Ages, not
 * clock times, so the text reads the same in every time zone. */
function ago(iso, now) {
  const at = Date.parse(iso ?? '');
  if (Number.isNaN(at)) return 'at an unknown time';
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${String(minutes % 60).padStart(2, '0')}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** `<value> <label>`, or `<label> unavailable: <reason>` for a value that could not be read. */
function counted(value, label) {
  return value?.unavailable ? `${label} unavailable: ${value.unavailable}` : `${value} ${label}`;
}

function workLine(work, now) {
  const id = work.id ?? '(no id yet)';
  const kind = work.kind ? ` (${work.kind})` : '';
  const file = work.file?.modifiedAt ? `file written ${ago(work.file.modifiedAt, now)}` : `file unavailable: ${work.file?.unavailable ?? 'not looked up'}`;
  return `    ${work.tool} ${id}${kind} ${JSON.stringify(work.description ?? '')}  launched ${ago(work.launchedAt, now)}  ${file}`;
}

function sessionLines(session, now) {
  const id = session.id.slice(0, 8);
  if (session.unavailable) return [`${id}  unavailable: ${session.unavailable}`];
  const state = session.stateReason ? `${session.state} (${session.stateReason})` : session.state;
  const lines = [`${id}  ${state}  ${session.title ?? '(no title)'}  last entry ${ago(session.lastEntryAt, now)}`];
  const recorded = (value) => value ?? 'unavailable: no entry records it';
  lines.push(`  cwd ${recorded(session.cwd)}  branch ${recorded(session.gitBranch)}`);

  if (session.work.length > 0) {
    const open = session.work.filter((work) => !work.ended);
    const ended = session.work.filter((work) => work.ended);
    // Every piece without a recorded end gets its own line; the ended ones are a count and the latest,
    // because a long session has hundreds and the board is read on a phone.
    const last = ended.reduce((latest, work) => (latest === null || String(work.endedAt) > String(latest.endedAt) ? work : latest), null);
    const lastText = last ? ` (last: ${last.tool} ${JSON.stringify(last.description ?? '')} ${last.status} ${ago(last.endedAt, now)})` : '';
    lines.push(`  work: ${open.length} with no recorded end, ${ended.length} ended${lastText}`);
    for (const work of open) lines.push(workLine(work, now));
  }
  if (session.skippedLines > 0) lines.push(`  ${session.skippedLines} transcript line${session.skippedLines === 1 ? '' : 's'} skipped: it did not parse`);
  for (const line of session.tail) lines.push(`  | ${line.length > TAIL_WIDTH ? `${line.slice(0, TAIL_WIDTH - 1)}…` : line}`);
  return lines;
}

/** One section of machine facts: its title, then a line per item, `empty` when there is none, or the
 * reason the whole list could not be read. */
function sectionLines(title, fact, empty, itemLine) {
  if (!fact.available) return [title, `  unavailable: ${fact.reason}`, ''];
  return [title, ...(fact.items.length === 0 ? [`  ${empty}`] : fact.items.map(itemLine)), ''];
}

/** The board as lines of text: the sessions (in the order given, most recent first), then worktrees,
 * running gates and open pull requests, and a last line that says what the board cannot see. */
export function renderBoard(board, { now }) {
  const lines = [`Sessions  ${board.root}  ${board.sessions.length} changed in the last ${board.hours}h`, ''];
  for (const session of board.sessions) lines.push(...sessionLines(session, now), '');

  lines.push(
    ...sectionLines('Worktrees', board.worktrees, 'none', (tree) => {
      const upstream = tree.aheadOfUpstream === 'no upstream' ? 'no upstream' : counted(tree.aheadOfUpstream, 'not pushed');
      return `  ${tree.path}  ${tree.branch ?? (tree.bare ? '(bare)' : '(detached)')}  ${(tree.head ?? '').slice(0, 7)}  ${counted(tree.aheadOfMain, 'not on origin/main')}, ${upstream}, ${counted(tree.changed, 'changed')}`;
    }),
    ...sectionLines('Gates', board.gates, 'none running', (gate) => {
      const worktree = gate.worktree?.unavailable ? `worktree unavailable: ${gate.worktree.unavailable}` : gate.worktree;
      const started = gate.startedAt?.unavailable ? `start unavailable: ${gate.startedAt.unavailable}` : `started ${ago(gate.startedAt, now)}`;
      return `  pid ${gate.pid}  ${worktree}  ${started}  ${gate.commandLine}`;
    }),
    ...sectionLines('Pull requests', board.pullRequests, 'none open', (pr) => `  #${pr.number}  ${pr.title}  (${pr.branch})`),
    NOT_VISIBLE,
  );
  return lines;
}
