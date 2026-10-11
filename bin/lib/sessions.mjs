// Pure facts for `bin/sessions.mjs` — see odd/tasks/session-board.md (## Design records the transcript
// format this file reads, established from real transcripts). No fs and no process here: a transcript's
// text goes in and session facts come out, and every external command is a `run` the caller hands in,
// so the tests use inline synthetic transcripts and fake commands, never this machine's sessions.
import { parseSnapshot } from './process-tree.mjs';
import { parseFeature, tokenize } from './progress.mjs';

const TITLE_LENGTH = 60;

/** The window a context is a share of, in tokens. One reading of this machine, 2026-10-06: the desktop
 * app showed 71% for a session the board gave 342,000 tokens, which is a window of about 480,000. It
 * belongs to the model and the app, so it is a default (`--context-window`), not a constant. */
export const DEFAULT_CONTEXT_WINDOW = 480000;

/** The share of the window above which a session is marked as past the limit. It limits nothing: it is
 * where the board says "replace this session before the harness compacts it". Every automatic compaction
 * in this project's transcripts (six of six) fired between 466,887 and 468,151 tokens; 73% of the window
 * is 350,400, which leaves about 115,000 tokens to hand over in, and the user's own manual compactions
 * sat around it (243,607 to 406,565, median 322,517). A new session starts near 84,000. */
export const DEFAULT_CONTEXT_LIMIT_PERCENT = 73;
export const DEFAULT_CONTEXT_LIMIT = Math.round((DEFAULT_CONTEXT_WINDOW * DEFAULT_CONTEXT_LIMIT_PERCENT) / 100);

/** `tokens` as a whole percentage of `window`: the number the desktop app shows for a context. */
export function percentOf(tokens, window) {
  return Math.round((tokens / window) * 100);
}
const NOTIFICATION_PATTERN = /<task-notification>([\s\S]*?)<\/task-notification>/g;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** A transcript's entries, one JSON object per line. A line that does not parse, or that parses to
 * something other than an object (`null`, a number, a string, a list), is skipped and counted, never
 * fatal: a session appends to its transcript while the board reads it, so the last line may be half
 * written, and nothing below has to ask whether an entry is one. */
export function parseTranscript(text) {
  const entries = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      skipped += 1;
      continue;
    }
    if (isObject(entry)) entries.push(entry);
    else skipped += 1;
  }
  return { entries, skipped };
}

/** The content blocks of an entry's message: the objects of its `content` list, and none when the
 * content is a string or missing. Whatever else sits in the list is not a block and is left out. */
function blocksOf(entry) {
  const content = entry.message?.content;
  return Array.isArray(content) ? content.filter(isObject) : [];
}

/** A block that carries text: `type: "text"` with a string in `text`. */
const isText = (block) => block.type === 'text' && typeof block.text === 'string';

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
  const text = typeof content === 'string' ? content : blocksOf(entry).find(isText)?.text;
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
  const blocks = blocksOf(entry);
  if (entry.type === 'assistant') {
    if (blocks.some((block) => block.type === 'tool_use')) return 'working';
    // Every block of a message is its own entry and all of them carry the message's stop reason, so a
    // text block closes the turn only when the message did not stop to call a tool.
    return blocks.some(isText) && entry.message.stop_reason !== 'tool_use' ? 'ended' : 'working';
  }
  if (entry.type !== 'user') return null;
  if (entry.isCompactSummary) return 'ended';
  if (typeof content === 'string') return content.trimStart().startsWith('<local-command-stdout>') ? 'ended' : 'working';
  if (!Array.isArray(content)) return null;
  if (blocks.some((block) => block.type === 'tool_result')) return 'working';
  return blocks.some((block) => isText(block) && block.text.startsWith('[Request interrupted')) ? 'ended' : 'working';
}

/** The context a reply was sent with, `{ tokens, model, at }`: its input tokens plus what it read from
 * and wrote to the prompt cache, which together are everything the model was given for that reply (the
 * harness's own count at a compaction is within half a percent of it). `null` for an entry that is not
 * the session's own reply with usage: a side chain, a message the harness wrote itself (model
 * `<synthetic>`, all zeros), an entry with no usage. */
function contextOf(entry) {
  if (entry.type !== 'assistant' || entry.isSidechain || !isObject(entry.message) || entry.message.model === '<synthetic>') return null;
  const usage = entry.message.usage;
  if (!isObject(usage) || !Number.isFinite(usage.input_tokens)) return null;
  const counted = (value) => (Number.isFinite(value) ? value : 0);
  const tokens = usage.input_tokens + counted(usage.cache_read_input_tokens) + counted(usage.cache_creation_input_tokens);
  if (tokens <= 0) return null;
  return { tokens, model: typeof entry.message.model === 'string' ? entry.message.model : null, at: entry.timestamp ?? null };
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
    resumed: false,
    ended: false,
    endedAt: null,
    status: null,
  };
}

/** The work a follow-up starts: a `SendMessage` call whose result says the subagent `agent` runs again.
 * It is a piece of its own, with the subagent's id, because it has its own call, launch time and end;
 * `resumed` tells it from the subagent's first run, whose `kind` it keeps. Its description is the
 * follow-up's `summary`. */
function resumedWork(block, entry, agent, kind) {
  return { ...newWork(block, entry, 'background'), tool: 'Agent', kind, id: agent, description: block.input?.summary ?? null, resumed: true };
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
 * Work is every `Agent` call, every `Bash` call that went to the background, and every `SendMessage`
 * call that resumed a subagent. Its id (the task id of a shell, the agent id of a subagent) comes from
 * the tool result that follows the call, never from the call itself, so work whose result is not written
 * yet has `id: null`. A foreground `Agent` call ends with its tool result; everything else ends with a
 * task notification that carries a status.
 *
 * An end closes only work launched before it. One that names a call closes that call's piece, and any
 * older piece of the same id still open; one that names only the task closes every open piece of that
 * id. A piece launched afterwards under the same id (a follow-up to the same subagent) is open until
 * its own end. An end that arrives before the result that gives its work an id is kept, and used once,
 * for the call it names (whatever older work it closed on the way) or, when it names none and closed
 * nothing, for a call that is not a follow-up.
 *
 * `turnEndedAt` is the time of the entry that ended the turn, and `null` while the session works: two
 * looks that both find the session waiting tell by it whether it finished another turn in between.
 *
 * `context` is what the session's last reply was sent with (`contextOf`), or, after a compaction and
 * until the next reply, what the harness says the compaction left. `contextPercent` is its share of
 * `contextWindow` and `pastContextLimit` says whether it is above `contextLimit` (tokens); both are
 * `null` when the context could not be read. */
export function sessionFacts(text, { tail = 3, contextLimit = DEFAULT_CONTEXT_LIMIT, contextWindow = DEFAULT_CONTEXT_WINDOW } = {}) {
  const { entries, skipped } = parseTranscript(text);
  const calls = new Map(); // tool_use id -> the tool_use block, the entry that holds it and that entry's index
  const workByCall = new Map(); // tool_use id -> work
  const endsByTask = new Map(); // task id -> the latest end that closed nothing, and the index of its entry
  const launchIndex = (work) => calls.get(work.toolUseId).index;
  let customTitle = null;
  let firstPrompt = null;
  let lastEntryAt = null;
  let cwd = null;
  let gitBranch = null;
  let turn = null;
  let turnEndedAt = null;
  let lastReply = null;
  let context = null;

  for (const [index, entry] of entries.entries()) {
    context = contextOf(entry) ?? context;
    // A compaction replaces the context: until the next reply the harness's own count is all there is.
    if (entry.type === 'system' && entry.subtype === 'compact_boundary' && Number.isFinite(entry.compactMetadata?.postTokens)) {
      context = { tokens: entry.compactMetadata.postTokens, model: context?.model ?? null, at: entry.timestamp ?? null };
    }
    if (entry.type === 'custom-title' && typeof entry.customTitle === 'string') customTitle = entry.customTitle;
    if (typeof entry.timestamp === 'string' && (lastEntryAt === null || entry.timestamp > lastEntryAt)) lastEntryAt = entry.timestamp;
    if (typeof entry.cwd === 'string') cwd = entry.cwd;
    if (typeof entry.gitBranch === 'string') gitBranch = entry.gitBranch;
    firstPrompt ??= promptText(entry);
    const said = turnOf(entry);
    if (said !== null) {
      turn = said;
      turnEndedAt = said === 'ended' ? (entry.timestamp ?? null) : null;
    }

    for (const { task, toolUse, status } of notificationsOf(entry)) {
      if (status === undefined) continue; // an event of a task that is still running
      const at = entry.timestamp ?? entry.attachment?.timestamp;
      const named = toolUse === undefined ? undefined : workByCall.get(toolUse);
      let closed = false;
      for (const work of workByCall.values()) {
        const sameTask = task !== undefined && work.id === task;
        // The end of the run a call started is not the end of a run started after it under the same id,
        // which matters when a resumed session writes an old notification again.
        const hit = named ? work === named || (sameTask && launchIndex(work) < launchIndex(named)) : sameTask;
        if (!hit || work.ended) continue;
        end(work, at, status);
        closed = true;
      }
      // An end that closed nothing may be early: a quick task can end before the tool result that gives
      // its work the id. It is kept by task id for the call that was made before it, and no other. One
      // that names a call with no work yet is kept as well when it closed older work of the same id: a
      // follow-up's work starts with its result, and its end closes a first run that recorded none.
      if (!named && task !== undefined && (!closed || toolUse !== undefined)) endsByTask.set(task, { at, status, index, toolUse });
    }
    if (entry.isSidechain) continue;

    for (const block of blocksOf(entry)) {
      if (entry.type === 'assistant' && isText(block) && block.text.trim() !== '') lastReply = block.text;
      // A resumed session writes earlier entries again: only the first sight of a call launches work, so
      // a repeated call never reopens work whose end was recorded in between.
      if (entry.type === 'assistant' && block.type === 'tool_use' && !calls.has(block.id)) {
        calls.set(block.id, { block, entry, index });
        if (isAgent(block.name)) workByCall.set(block.id, newWork(block, entry, block.input?.run_in_background === true ? 'background' : 'foreground'));
        else if (block.name === 'Bash' && block.input?.run_in_background === true) workByCall.set(block.id, newWork(block, entry, 'background'));
      }
      if (entry.type !== 'user' || block.type !== 'tool_result' || !calls.has(block.tool_use_id)) continue;
      const launch = calls.get(block.tool_use_id);
      const outcome = isObject(entry.toolUseResult) ? entry.toolUseResult : {};
      let work = workByCall.get(block.tool_use_id);
      if (launch.block.name === 'SendMessage') {
        // A follow-up starts work only when its result says the subagent had stopped and runs again
        // (`resumedAgentId`); a message queued for a subagent that is still running starts nothing.
        if (!work && typeof outcome.resumedAgentId === 'string') {
          const firstRun = [...workByCall.values()].find((earlier) => earlier.id === outcome.resumedAgentId);
          workByCall.set(block.tool_use_id, (work = resumedWork(launch.block, launch.entry, outcome.resumedAgentId, firstRun?.kind ?? null)));
        }
      } else if (typeof outcome.backgroundTaskId === 'string') {
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
      // The notification of a quick task can be written before this result. The end kept for its id is
      // this work's only when the call came before it, and it is used once: work launched later under
      // the same id is not closed by it. An end that names a call is that call's alone; one that names
      // only the task is never the end of a follow-up, whose own end names it: between a follow-up and
      // its result it can only be the first run's end written again.
      const early = work ? endsByTask.get(work.id) : undefined;
      const itsOwn = early && (early.toolUse === undefined ? !work.resumed : early.toolUse === block.tool_use_id);
      if (itsOwn && launch.index < early.index) {
        end(work, early.at, early.status);
        endsByTask.delete(work.id);
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
    context: context ?? { unavailable: 'no reply of the transcript records its token usage' },
    contextPercent: context === null ? null : percentOf(context.tokens, contextWindow),
    pastContextLimit: context === null ? null : context.tokens > contextLimit,
    state: turn === null ? 'unknown' : turn === 'working' ? 'working' : work.some((item) => !item.ended) ? 'background' : 'waiting',
    turnEndedAt,
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

/** Why a command failed, in one line: what the system said when it could not be started, the first line
 * it wrote to stderr, or its exit code when it wrote nothing. ENOENT has two causes the error does not
 * tell apart: a program that is not there, and a folder to run it in that is not there. `ranIn` is that
 * folder when the caller knows the program starts (it has just run), and then the folder is what is
 * missing. */
function failure(command, result, { ranIn } = {}) {
  if (result.error?.code === 'ENOENT') return ranIn === undefined ? `${command} is not installed or not on PATH` : `the folder ${ranIn} does not exist (ENOENT starting ${command} there)`;
  if (result.error) return result.error.message;
  return String(result.stderr ?? '').trim().split(/\r?\n/)[0] || `exit ${result.status}`;
}

/** The entries of `git worktree list --porcelain`: `{ path, head, branch, bare, prunable }`, `branch`
 * without its `refs/heads/` and `null` for a detached or bare entry. `prunable` is the reason git gives
 * for an entry it would prune (its folder is gone), and `null` for every other entry. */
export function parseWorktreeList(porcelain) {
  const trees = [];
  for (const line of porcelain.split(/\r?\n/)) {
    const [key, ...rest] = line.split(' ');
    const value = rest.join(' ');
    if (key === 'worktree') trees.push({ path: value, head: null, branch: null, bare: false, prunable: null });
    else if (trees.length === 0) continue;
    else if (key === 'HEAD') trees.at(-1).head = value;
    else if (key === 'branch') trees.at(-1).branch = value.replace(/^refs\/heads\//, '');
    else if (key === 'bare') trees.at(-1).bare = true;
    else if (key === 'prunable') trees.at(-1).prunable = value || 'git gives no reason';
  }
  return trees;
}

/** The count a command printed: digits and nothing else. Empty output is not zero, and `0x10`, `1e3` and
 * `-1`, which `Number` would take, are not counts. `null` for anything else. */
function printedCount(stdout) {
  const printed = stdout.trim();
  return /^\d+$/.test(printed) ? Number(printed) : null;
}

/** One count git gives for a worktree, or why it could not be read. It runs after the list of worktrees
 * was read with the same `git`, so a spawn that fails with ENOENT is the worktree's folder missing. */
function gitCount(run, cwd, args, parse = printedCount) {
  const what = `git ${args.find((arg) => !arg.startsWith('-'))}`;
  const result = run('git', args, { cwd });
  if (failed(result)) return { failed: result, unavailable: `${what}: ${failure('git', result, { ranIn: cwd })}` };
  const value = parse(result.stdout);
  if (value === null) return { unavailable: `${what}: printed ${JSON.stringify(result.stdout.trim())}, not a count` };
  return value;
}

const PENDING_LENGTH = 40;

/** One feature document as a plan: `{ path, title, done, total, pending, nextStep }`. Title and checkboxes
 * are `parseFeature`'s (bin/lib/progress.mjs), so the board counts what `js-harness progress` counts.
 * `pending` names each unchecked step by the id that starts it (`T5`, `T3b`), or by the start of its text
 * when it has none. `nextStep` is every non-blank line of the `## Next step` section, all of them, because
 * a watch compares the whole text; the text board prints the first few. */
export function planOf(markdown, docPath) {
  const id = docPath.split('/').at(-1).replace(/\.md$/, '');
  const { title, done, total, steps } = parseFeature(markdown, id);
  const pending = steps
    .filter((step) => !step.done)
    .map((step) => /^([A-Za-z]{1,6}\d+[a-z]?)(?=[\s:]|$)/.exec(step.text)?.[1] ?? (step.text.length > PENDING_LENGTH ? `${step.text.slice(0, PENDING_LENGTH)}…` : step.text));
  const nextStep = [];
  let inSection = false;
  for (const token of tokenize(markdown)) {
    if (token.heading && token.heading.level <= 2) {
      if (inSection) break;
      inSection = token.heading.level === 2 && token.heading.title.toLowerCase() === 'next step';
    } else if (inSection && token.line.trim() !== '') {
      nextStep.push(token.line.trim());
    }
  }
  return { path: docPath, title, done, total, pending, nextStep };
}

/** The plans of the branch checked out at `cwd`: its feature documents, `odd/tasks/*.md`, that differ
 * from `origin/main` — changed by a commit of the branch or in the working tree (a diff of the working
 * tree against the merge base, so what `main` gained since the branch was cut is not the branch's), or
 * not tracked yet. Each is read with `readFile` and is a `planOf`, or `{ path, unavailable }` when it
 * cannot be read. A worktree on `main` with nothing changed has none.
 *
 * Both listings ask for `-z`: names as they are, one per NUL. Line by line git prints a name with a
 * character outside ASCII inside quotes with escapes, which is not a path and was dropped in silence.
 * Neither takes the index lock (`--no-optional-locks`) a session committing in that worktree needs. */
export function readPlans(run, readFile, cwd) {
  const names = new Set();
  for (const args of [
    ['--no-optional-locks', 'diff', '--name-only', '--diff-filter=d', '--merge-base', 'origin/main', '-z', '--', 'odd/tasks'],
    ['--no-optional-locks', 'ls-files', '--others', '--exclude-standard', '-z', '--', 'odd/tasks'],
  ]) {
    const listed = run('git', args, { cwd });
    if (failed(listed)) return { available: false, reason: `git ${args.find((arg) => !arg.startsWith('-'))}: ${failure('git', listed, { ranIn: cwd })}` };
    for (const name of listed.stdout.split('\0')) if (/^odd\/tasks\/[^/]+\.md$/.test(name)) names.add(name);
  }
  const items = [...names].sort().map((name) => {
    try {
      return planOf(readFile(`${cwd.replace(/[\\/]+$/, '')}/${name}`), name);
    } catch (err) {
      return { path: name, unavailable: err.code ?? err.message };
    }
  });
  return { available: true, items };
}

/** Every worktree of the repository at `root`: `path`, `branch`, `head`, `aheadOfMain` (commits not on
 * `origin/main`), `aheadOfUpstream` (commits not on its upstream, or `'no upstream'`) and `changed`
 * (files `git status` lists). The status is read with `--no-optional-locks`, so the board never holds
 * the index lock a session committing in that worktree needs. With `readFile`, each worktree also
 * carries `plans`, the feature plans of its branch (`readPlans`). */
export function readWorktrees(run, root, { readFile } = {}) {
  const listed = run('git', ['worktree', 'list', '--porcelain'], { cwd: root });
  if (failed(listed)) return { available: false, reason: `git worktree: ${failure('git', listed)}` };
  const items = parseWorktreeList(listed.stdout).map((tree) => {
    if (tree.bare || tree.prunable !== null) {
      // Nothing is run in a folder git itself reports gone: the spawn would fail with ENOENT, which reads
      // like a missing git.
      const none = { unavailable: tree.bare ? 'a bare repository has no checkout' : `its folder is gone: git lists the worktree as prunable (${tree.prunable})` };
      return { ...tree, aheadOfMain: none, aheadOfUpstream: none, changed: none, ...(readFile && { plans: { available: false, reason: none.unavailable } }) };
    }
    const aheadOfMain = gitCount(run, tree.path, ['rev-list', '--count', 'origin/main..HEAD']);
    let aheadOfUpstream = gitCount(run, tree.path, ['rev-list', '--count', '@{upstream}..HEAD']);
    // A branch that was never pushed and a detached HEAD have no upstream: that is an answer, not a failure.
    if (aheadOfUpstream.failed && /no upstream|does not point to a branch/i.test(String(aheadOfUpstream.failed.stderr))) aheadOfUpstream = 'no upstream';
    const changed = gitCount(run, tree.path, ['--no-optional-locks', 'status', '--porcelain'], (stdout) => stdout.split(/\r?\n/).filter((line) => line !== '').length);
    const fact = (value) => (value?.unavailable ? { unavailable: value.unavailable } : value);
    return { ...tree, aheadOfMain: fact(aheadOfMain), aheadOfUpstream: fact(aheadOfUpstream), changed: fact(changed), ...(readFile && { plans: readPlans(run, readFile, tree.path) }) };
  });
  return { available: true, items };
}

/** `[{ pid, createdAt, commandLine }]` from what the Windows listing of `bin/sessions.mjs` prints: a row
 * of the shared process listing per process (`parseSnapshot` of `bin/lib/process-tree.mjs`), a line
 * `C<TAB>pid<TAB>command line` for it, and as its last line `OK<TAB>count`, the number of `C` lines it
 * wrote. Throws when the last line is not that marker, or when its count is not the number of `C` lines
 * read: "no gate is running" must never be read from a listing that stopped half way or lost lines. */
export function parseProcessList(stdout) {
  const lines = stdout.split(/\r?\n/).filter((line) => line !== '');
  const marker = /^OK\t(\d+)$/.exec(lines.at(-1) ?? '');
  if (!marker) throw new Error('the listing did not finish');
  const createdAt = new Map(parseSnapshot(stdout).map((row) => [row.pid, row.createdAt]));
  const found = lines
    .map((line) => /^C\t(\d+)\t(.*)$/.exec(line))
    .filter(Boolean)
    .map((match) => ({ pid: Number(match[1]), createdAt: createdAt.get(Number(match[1])) ?? null, commandLine: match[2] }));
  if (found.length !== Number(marker[1])) throw new Error(`the listing announces ${marker[1]} command lines and holds ${found.length}`);
  return found;
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

// The dispatcher as one whole argument: `js-harness.mjs`, alone or after a separator, or `js-harness` after
// one, which is how an install links the file where a shebang runs it (`/usr/local/bin/js-harness`). The
// folder before it is the first or the second group.
const DISPATCHER_PATTERN = /^(?:(.*)[\\/])?js-harness\.mjs$|^(.*)[\\/]js-harness$/;

/** The arguments of a command line, each without its quotes: a stretch between double quotes is part of
 * one argument, spaces and all. A `ps` listing has no quotes, so there every space ends an argument. */
function argumentsOf(commandLine) {
  return (commandLine.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []).map((argument) => argument.replace(/"/g, ''));
}

/** The dispatcher a command line runs the gate through, as `js-harness check`: the argument that is the
 * dispatcher and has `check` as the very next one. That is the gate in the dispatcher's own process, with
 * no `bin/check.mjs` on any command line, and it is what the pre-commit hook of `js-harness init` runs.
 * `undefined` when there is none: `contract check`, `checkout` and a test whose name says "js-harness
 * check" are not that. */
function gateDispatcher(args) {
  return args.find((argument, index) => DISPATCHER_PATTERN.test(argument) && args[index + 1] === 'check');
}

/** The one of `worktrees` whose own dispatcher `dispatcher` is (`<worktree>/bin/js-harness.mjs`), which
 * is taken to check that checkout as its `bin/check.mjs` is. Any other dispatcher is an install, or a
 * relative path: the gate checks the folder it runs in, and nothing on the command line says which. */
function dispatcherWorktree(dispatcher, worktrees) {
  const [, inFolder, linkedIn] = DISPATCHER_PATTERN.exec(dispatcher);
  const checkout = /^(.*)[\\/]bin$/.exec(inFolder ?? linkedIn ?? '')?.[1];
  const known = checkout === undefined ? undefined : worktrees.find((tree) => comparable(tree) === comparable(checkout));
  return known ?? { unavailable: 'js-harness check checks the folder it runs in, and its command line names none' };
}

/** The worktree a command line names `bin/check.mjs` under: `folder`, in the spelling of `worktrees` when
 * it is one of them. A relative path names none. */
function gateFileWorktree(folder, worktrees) {
  const known = worktrees.find((tree) => comparable(tree) === comparable(folder));
  return /^([A-Za-z]:|[\\/])/.test(folder) ? (known ?? folder) : { unavailable: 'its command line names bin/check.mjs by a relative path' };
}

/** Whether the gate that runs `script` knows the machine's gate lock (`bin/lib/gate-lock.mjs`): `true`
 * or `false` as `lockLibraryBeside(script)` says, which is asked whether the lock's library is beside
 * that script, `lib/gate-lock.mjs` in its folder; `{ unavailable }` for a script named by a relative
 * path, which nothing places (a process has no working directory the listing could read).
 *
 * It is a fact of the script and not of what the process is doing, so it is the same at every look. A
 * gate that knows the lock runs its sensors only while it holds it; one that does not is a gate of a
 * checkout from before the lock, and runs them whenever it is started. */
function knowsLockOf(script, lockLibraryBeside) {
  if (!/^([A-Za-z]:|[\\/])/.test(script)) return { unavailable: 'its command line names its script by a relative path' };
  return lockLibraryBeside(script) === true;
}

/** The running gates among `processes`: every process whose program is `node` and whose command line
 * names `bin/check.mjs` as an argument, or runs `check` through the dispatcher (`gateDispatcher`). A
 * shell whose text mentions either is not one, and neither is `bin/check.test.mjs`. `worktree` is the
 * folder the gate checks as far as the command line says (`gateFileWorktree`, `dispatcherWorktree`): a
 * process has no working directory the listing could read instead. `knowsLock` says whether the script
 * it runs, `bin/check.mjs` or the dispatcher, has the lock's library beside it (`knowsLockOf`); with no
 * `lockLibraryBeside` to ask, none has. */
export function findGates(processes, worktrees = [], { lockLibraryBeside = () => false } = {}) {
  const gates = [];
  for (const { pid, createdAt, commandLine } of processes) {
    const program = /^\s*(?:"([^"]+)"|(\S+))/.exec(commandLine);
    if (!program || !/(^|[\\/])node(\.exe)?$/i.test(program[1] ?? program[2])) continue;
    const rest = commandLine.slice(program[0].length);
    const named = GATE_PATTERN.exec(rest);
    const dispatcher = named ? undefined : gateDispatcher(argumentsOf(rest));
    if (!named && dispatcher === undefined) continue;
    gates.push({
      pid,
      startedAt: Number.isFinite(createdAt) ? new Date(createdAt).toISOString() : { unavailable: 'the process listing gave no start time' },
      worktree: named ? gateFileWorktree(named[1] ?? named[2] ?? '', worktrees) : dispatcherWorktree(dispatcher, worktrees),
      knowsLock: knowsLockOf(named ? named[0].replace(/"/g, '') : dispatcher, lockLibraryBeside),
      commandLine,
    });
  }
  return gates;
}

/** The gates among the machine's processes, from `listProcesses()` (which throws when it could not look).
 * Which of them runs its sensors and which waits for its turn is the lock's to say (`boardGates`).
 * `options` are those of `findGates`. */
export function readGates(listProcesses, worktrees = [], options = {}) {
  try {
    return { available: true, items: findGates(listProcesses(), worktrees, options) };
  } catch (err) {
    return { available: false, reason: `the process listing: ${err.message}` };
  }
}

/** What the machine's gate lock says (`bin/lib/gate-lock.mjs`): `{ available: true, holder, waiters }`,
 * from `read()`, which gives `{ holder, waiters }` as `readGateHolder` and `readGateWaiters` do and throws
 * when it could not look. `holder` is `null` for a free lock, else `{ pid, cwd, command, startedAt, beatAt,
 * stale }`: when it took the lock, its last beat as a date, and whether it stopped beating. A waiter is
 * `{ pid, cwd, command, waitingSince }`. Each field is `null` where the gate's file does not say it.
 * `readAt` is the clock `read()` says it read against, as a date, where it says one: `stale` was judged
 * against it, so the ages of these gates are said against it as well (`gateLines`).
 *
 * The process listing shows every `check` process and cannot tell one that runs its sensors from one that
 * waits for its turn, nor which folder an installed `js-harness check` checks; the lock says all three. */
export function readGateLock(read) {
  try {
    const { holder, waiters, readAt } = read();
    const beatAt = holder === null || holder.beatAt === null ? null : new Date(holder.beatAt).toISOString();
    return {
      available: true,
      holder: holder && { pid: holder.pid, cwd: holder.cwd, command: holder.command, startedAt: holder.startedAt, beatAt, stale: holder.stale },
      waiters: waiters.map(({ pid, cwd, command, waitingSince }) => ({ pid, cwd, command, waitingSince })),
      ...(readAt !== undefined && { readAt: new Date(readAt).toISOString() }),
    };
  } catch (err) {
    return { available: false, reason: `the gate lock: ${err.message}` };
  }
}

/** Whether the listing says that the process `item` started after `since`, an ISO time: `false` when
 * either side gives no time. */
function startedAfter(item, since) {
  return typeof item.startedAt === 'string' && typeof since === 'string' && Date.parse(item.startedAt) > Date.parse(since);
}

/** The gates of `board`, as it prints them and as a watch compares them: what the lock and the process
 * listing say together. First the gate that holds the machine's gate lock, then the gates that wait for
 * it, the longest wait first, then every other `check` process of the listing, given as the listing has
 * it: a gate that does not know the lock (a checkout from before it) and runs its sensors as it always
 * did, or one that knows it (`knowsLock`) and is not in its sensors, having not reached them yet or
 * being past them.
 *
 * A gate of the lock has `lock`: `{ role: 'holder', command, since, beatAt, stale }` or `{ role: 'waiter',
 * command, since, for }`, `for` being the pid of the gate it waits for. Its `worktree` is the folder its
 * file names, in the board's spelling when it is one of its worktrees, and the listing's only where the
 * file names none. The process that is this gate gives `startedAt` and `commandLine`, so that process is
 * listed once; with no such process (the listing failed, or it runs where the listing cannot see) both
 * are `{ unavailable }` and the gate is still given, from the lock. A gate read as a waiter and as the
 * holder took the lock between the two reads: it is the holder.
 *
 * Which process is a gate of the lock is told by its pid, and decides only what that gate's line shows.
 * A pid is free again once its process ends, and the file of a gate that was killed is there for a
 * minute more, so the process with the pid is not that gate when it cannot be: its script does not have
 * the lock's library (`knowsLock` is `false`), or the listing says it started after the gate took the
 * lock, or began to wait. A first version took every process with the pid, and showed a new gate as the
 * dead one (found in review, 2026-10-10).
 *
 * A board with no `gateLock`, or one that could not be read, has the gates of its process listing alone. */
export function boardGates(board) {
  const lock = board.gateLock?.available ? board.gateLock : { holder: null, waiters: [] };
  const listed = board.gates.available ? board.gates.items : [];
  const trees = board.worktrees?.available ? board.worktrees.items.map((tree) => tree.path) : [];
  const matched = new Set();
  const noProcess = (pid) => {
    if (!board.gates.available) return { unavailable: 'the process listing could not be read' };
    return { unavailable: listed.some((item) => item.pid === pid) ? 'the listed process with this pid is not this gate' : 'no process of the listing has this pid' };
  };
  const ofLock = (gate, since, role) => {
    const process = gate.pid === null ? undefined : listed.find((item) => item.pid === gate.pid && !matched.has(item) && item.knowsLock !== false && !startedAfter(item, since));
    if (process) matched.add(process);
    const named = gate.cwd === null ? undefined : (trees.find((tree) => comparable(tree) === comparable(gate.cwd)) ?? gate.cwd);
    const worktree = named ?? process?.worktree ?? { unavailable: 'the gate lock does not say which folder it checks' };
    const none = process ? undefined : noProcess(gate.pid);
    return { pid: gate.pid, startedAt: process?.startedAt ?? none, worktree, commandLine: process?.commandLine ?? none, lock: { ...role, since, command: gate.command } };
  };
  const { holder } = lock;
  const holding = holder ? [ofLock(holder, holder.startedAt, { role: 'holder', beatAt: holder.beatAt, stale: holder.stale })] : [];
  const waiting = lock.waiters
    .filter((waiter) => waiter.pid === null || waiter.pid !== holder?.pid)
    .map((waiter) => ofLock(waiter, waiter.waitingSince, { role: 'waiter', for: holder?.pid ?? null }));
  return [...holding, ...waiting, ...listed.filter((item) => !matched.has(item))];
}

/** Whether a gate of `boardGates` is a process of the listing: one the lock alone tells of has no command
 * line. A watch compares processes, which start and end; what the lock says of them is how it words it. */
const isProcess = (gate) => typeof gate.commandLine === 'string';

/** Whether a gate of `boardGates` knows the machine's gate lock: its script has the lock's library beside
 * it, or the lock itself tells of it. The second is the one proof there is for a process whose command
 * line does not place its script (`npm run check` starts `node bin/check.mjs`), and it holds for as long
 * as that gate holds the lock or waits for it. */
const knowsLock = (gate) => gate.lock !== undefined || gate.knowsLock === true;

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

// ---- what changed between two boards ------------------------------------------------------------------
//
// `sessions --watch` looks at the board again and again and returns only when something on it calls for
// a decision. What that is, is decided here, from two boards and nothing else.

/** Whether `id` is the session named by `self`: its whole id, or its first eight characters or more. */
export function isSelf(id, self) {
  return typeof self === 'string' && self !== '' && (id === self || (self.length >= 8 && id.startsWith(self)));
}

/** How a board says context sizes: `of(tokens)` is `342k tokens (71%)`, `limit` is `73% (350k)`. The
 * percentage is the share of the board's context window, the number the desktop app shows; the limit
 * leads with it because that is how it is set and read. */
function contextSizes(board) {
  const window = board.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  const limit = board.contextLimit ?? DEFAULT_CONTEXT_LIMIT;
  return { of: (tokens) => `${thousands(tokens)} tokens (${percentOf(tokens, window)}%)`, limit: `${percentOf(limit, window)}% (${thousands(limit)})` };
}

const sessionLabel = (session) => `session ${session.id.slice(0, 8)} ${JSON.stringify(session.title ?? '(no title)')}`;
const pieces = (count) => `${count} piece${count === 1 ? '' : 's'} of work`;
const byKey = (items, key) => new Map(items.map((item) => [item[key], item]));

function sessionChanges(before, after, self) {
  const lines = [];
  const earlier = byKey(before.sessions, 'id');
  const sizes = contextSizes(after);
  for (const session of after.sessions) {
    const listed = earlier.get(session.id);
    // A transcript that cannot be read says nothing about what the session did.
    if (isSelf(session.id, self) || session.unavailable) continue;
    // The board to compare with keeps the last readable facts of a session (`watchBaseline`), so one that
    // is unreadable there was never read: this is the first look that says anything about it.
    const was = listed?.unavailable ? undefined : listed;
    if (!was) lines.push(`${sessionLabel(session)} appeared (${session.state})${listed ? ': its transcript could not be read until now' : ''}`);
    else if (session.state === 'waiting' && was.state !== 'waiting') {
      const open = was.work.filter((work) => !work.ended).length;
      const how = was.state === 'background' ? `: the ${pieces(open)} it had open ended` : '';
      lines.push(`${sessionLabel(session)} is waiting${how} (was ${was.state})`);
    } else if (session.state === 'waiting' && session.turnEndedAt !== was.turnEndedAt) {
      // Waiting at both looks, but not at the same point: it was given something and finished it.
      lines.push(`${sessionLabel(session)} finished another turn and is waiting`);
    }
    if (session.pastContextLimit === true && was?.pastContextLimit !== true) {
      lines.push(`${sessionLabel(session)} passed the context limit: ${sizes.of(session.context.tokens)}, limit ${sizes.limit}`);
    }
  }
  const now = new Set(after.sessions.map((session) => session.id));
  for (const session of before.sessions) {
    if (!now.has(session.id) && !isSelf(session.id, self)) lines.push(`${sessionLabel(session)} left the window of the last ${after.hours}h`);
  }
  return lines;
}

const gatePlace = (gate) => `in ${gate.worktree?.unavailable ? 'an unknown worktree' : gate.worktree} (${gate.pid === null ? 'pid unknown' : `pid ${gate.pid}`})`;

/** The gates of `board` a watch compares, or `null` when it cannot tell which they are (the gates or the
 * worktrees could not be listed). A gate whose command line names a folder that is none of the board's
 * worktrees is left out: the test suite of a running gate starts `bin/check.mjs` in temporary folders, and
 * those start and end all through it. One whose command line names no folder stays in: `npm run check`,
 * started by a relative path, is one, and so is the `js-harness check` of a pre-commit hook. Where the
 * lock names the folder a gate checks, that is its folder (`boardGates`): the lock is the machine's, so
 * the `js-harness check` of another project is then known to be none of this one's. */
function watchedGates(board) {
  if (!board.gates.available || !board.worktrees.available) return null;
  const trees = new Set(board.worktrees.items.map((tree) => comparable(tree.path)));
  return boardGates(board).filter((gate) => isProcess(gate) && (gate.worktree?.unavailable || trees.has(comparable(String(gate.worktree)))));
}

/** Whether two gates, of two looks, are one process: the same pid and the same start time. A pid is free
 * again once its process ends, so between two looks another gate can take it, and its start time is what
 * tells them apart. A look that has no start time for the gate (`ps` gives none) has the pid alone. */
function sameGate(one, other) {
  const timed = typeof one.startedAt === 'string' && typeof other.startedAt === 'string';
  return one.pid === other.pid && (!timed || one.startedAt === other.startedAt);
}

/** A gate started when it is no gate of the older board, and ended when it is none of the newer one
 * (`sameGate`): the worktrees say which gates are watched, never whether one runs. So a worktree removed
 * or added under a running gate is neither its end nor its start.
 *
 * A gate that starts and waits for the machine's gate lock is said so, with the gate it waits for: that
 * is one gate running and one in line, which is the lock doing its work and no mistake. Nothing is said
 * when it then takes the lock: the gate before it ended, which is said, and the board shows who runs.
 *
 * Two gates that run at once are still said, and they can only be so when one of them does not know the
 * lock (`knowsLock`), as every gate of a checkout from before it: such a gate runs its sensors whenever
 * it is started, and no gate waits for it. So the alarm is for a gate that does not know the lock, beside
 * another such gate or beside the gate that holds the lock and still beats; and for a gate that knows the
 * lock when it starts beside one that does not, which it will not wait for.
 *
 * A gate that knows the lock runs its sensors only while it holds it, so the lock alone says whether it
 * runs, and it is never "another gate" on the strength of the process listing, whatever it is doing: not
 * yet in line, in line, or past its sensors and writing its report. A first version worked that out for
 * each process from the listing and the lock, and each guess had a moment of being wrong: a process
 * listed before it stood in line, one past its sensors for more than a look, a pid used again (found in
 * two reviews, 2026-10-10). What is not seen from here: a gate that knows the lock and ran its sensors
 * without it, which happens when the lock can be neither read nor written, and its own report says so. */
function gateChanges(before, after) {
  const was = watchedGates(before);
  const is = watchedGates(after);
  if (was === null || is === null) return []; // a listing that failed is not a gate that ended
  const holder = boardGates(after).find((gate) => gate.lock?.role === 'holder');
  // The gate that holds the lock and still beats runs, whatever folder it checks: the lock is the
  // machine's. A lock of which nothing could be read, not even a pid, has shown no gate.
  const holding = holder && !holder.lock.stale && !(holder.pid === null && holder.lock.beatAt === null) ? [holder] : [];
  const without = is.filter((gate) => !knowsLock(gate));
  const lines = [];
  for (const gate of is) {
    if (before.gates.items.some((old) => sameGate(old, gate))) continue;
    if (gate.lock?.role === 'waiter') {
      lines.push(`gate started ${gatePlace(gate)}, waiting for ${holder ? `the gate ${gatePlace(holder)}` : "the machine's gate lock"}`);
      continue;
    }
    // Two gates at once is what the board exists to catch: they share the machine and one of them is
    // probably a mistake. A pid is one process, so a gate is never beside what carries its own.
    const other = (knowsLock(gate) ? without : [...holding, ...without]).find((item) => item.pid !== gate.pid);
    lines.push(`gate started ${gatePlace(gate)}${other ? ` while another runs ${gatePlace(other)}` : ''}`);
  }
  for (const gate of was) if (!after.gates.items.some((now) => sameGate(now, gate))) lines.push(`gate ended ${gatePlace(gate)}`);
  return lines;
}

function pullRequestChanges(before, after) {
  if (!before.pullRequests.available || !after.pullRequests.available) return [];
  const earlier = byKey(before.pullRequests.items, 'number');
  const now = byKey(after.pullRequests.items, 'number');
  const text = (pr) => `${pr.title} (${pr.branch})`;
  return [
    ...after.pullRequests.items.filter((pr) => !earlier.has(pr.number)).map((pr) => `pull request #${pr.number} opened: ${text(pr)}`),
    // The board lists the open ones only, so merged and closed look the same from here.
    ...before.pullRequests.items.filter((pr) => !now.has(pr.number)).map((pr) => `pull request #${pr.number} is no longer open: ${text(pr)}`),
  ];
}

const pendingText = (plan) => (plan.pending.length > 0 ? plan.pending.join(', ') : 'nothing');
const START_LENGTH = 100;

/** What changed in one feature plan, as the parts of one line; empty when nothing that matters did. */
function planDifferences(was, plan) {
  const parts = [];
  if (plan.done !== was.done || plan.total !== was.total) parts.push(`${plan.done}/${plan.total} done (was ${was.done}/${was.total})`);
  if (pendingText(plan) !== pendingText(was)) parts.push(`pending ${pendingText(plan)} (was ${pendingText(was)})`);
  if (plan.nextStep.join('\n') !== was.nextStep.join('\n')) {
    const start = plan.nextStep[0] ?? '';
    parts.push(plan.nextStep.length === 0 ? 'its next step is now empty' : `next step now starts ${JSON.stringify(start.length > START_LENGTH ? `${start.slice(0, START_LENGTH - 1)}…` : start)}`);
  }
  return parts;
}

function planChanges(before, after) {
  if (!before.worktrees.available || !after.worktrees.available) return [];
  const earlier = byKey(before.worktrees.items, 'path');
  const lines = [];
  for (const tree of after.worktrees.items) {
    // A worktree that was not there had no plan: one that arrives with a plan is a feature that starts.
    const was = earlier.has(tree.path) ? earlier.get(tree.path).plans : { available: true, items: [] };
    if (!tree.plans?.available || !was?.available) continue;
    const old = byKey(was.items, 'path');
    const now = byKey(tree.plans.items, 'path');
    for (const plan of tree.plans.items) {
      const previous = old.get(plan.path);
      if (plan.unavailable || previous?.unavailable) continue;
      if (!previous) {
        lines.push(`plan ${plan.path} appeared in ${tree.path}: ${plan.done}/${plan.total} done, pending ${pendingText(plan)}`);
        continue;
      }
      const parts = planDifferences(previous, plan);
      if (parts.length > 0) lines.push(`plan ${plan.path} in ${tree.path} changed: ${parts.join('; ')}`);
    }
    // A plan is listed while its document differs from origin/main, so this is also what a merge looks like.
    for (const plan of was.items) if (!now.has(plan.path)) lines.push(`plan ${plan.path} in ${tree.path} no longer differs from origin/main`);
  }
  return lines;
}

/** What changed from the board `before` to the board `after` that calls for a decision, one line each,
 * and `[]` when nothing did:
 *
 * - a session that appears, one that starts waiting (from any other state) or that waits again after
 *   another turn, one that passes the context limit, one that leaves the window;
 * - a gate that starts (said apart when it waits for the one that holds the machine's gate lock, and when
 *   it runs beside another and one of the two does not know the lock) or ends, among the gates of the
 *   board's worktrees (`watchedGates`, `gateChanges`);
 * - a pull request that opens or is no longer open;
 * - a feature plan that appears, stops differing from `origin/main`, or whose done or total count,
 *   pending tasks or next step changed.
 *
 * Everything else is left out on purpose, because it changes all the time and decides nothing: a session
 * that starts working, the age of a last entry or of a background file, the tail of a reply, a context
 * that grows below the limit, a piece of work that ends while others stay open, the counts of a worktree,
 * a gate that takes the lock it waited for.
 * `self` names the session that is watching, which is never compared: it works for as long as it watches.
 * A fact that could not be read on either side is not compared, so a failed listing is never a change. */
export function boardChanges(before, after, { self } = {}) {
  return [...sessionChanges(before, after, self), ...gateChanges(before, after), ...pullRequestChanges(before, after), ...planChanges(before, after)];
}

/** The board the next look is compared with: `newer`, with whatever it could not read taken from `older`.
 * Without this a transcript that was busy for one look, or one failed `gh` call, would hide the change
 * that happens across it. */
export function watchBaseline(older, newer) {
  const kept = (fact, previous) => (fact.available ? fact : previous);
  const sessions = byKey(older.sessions.filter((session) => !session.unavailable), 'id');
  const trees = older.worktrees.available ? byKey(older.worktrees.items, 'path') : new Map();
  const plansOf = (tree) => {
    const previous = trees.get(tree.path)?.plans;
    if (tree.plans === undefined || !previous?.available) return tree.plans;
    if (!tree.plans.available) return previous;
    const old = byKey(previous.items.filter((plan) => !plan.unavailable), 'path');
    return { ...tree.plans, items: tree.plans.items.map((plan) => (plan.unavailable ? (old.get(plan.path) ?? plan) : plan)) };
  };
  return {
    ...newer,
    sessions: newer.sessions.map((session) => (session.unavailable ? (sessions.get(session.id) ?? session) : session)),
    // Which gates are compared depends on the worktrees (`watchedGates`): a look that could not list them
    // compared none, so its gates are not yet what the next look is compared with.
    gates: newer.worktrees.available ? kept(newer.gates, older.gates) : older.gates,
    // What the lock said last still names the folder of a gate whose command line names none (`watchedGates`).
    ...(newer.gateLock && { gateLock: newer.gateLock.available ? newer.gateLock : (older.gateLock ?? newer.gateLock) }),
    pullRequests: kept(newer.pullRequests, older.pullRequests),
    worktrees: newer.worktrees.available ? { ...newer.worktrees, items: newer.worktrees.items.map((tree) => (tree.plans === undefined ? tree : { ...tree, plans: plansOf(tree) })) } : older.worktrees,
  };
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
  // `resumed` says the subagent was sent a follow-up and is running again, not a second subagent.
  const labels = [work.kind, work.resumed ? 'resumed' : null].filter(Boolean);
  const kind = labels.length > 0 ? ` (${labels.join(', ')})` : '';
  const file = work.file?.modifiedAt ? `file written ${ago(work.file.modifiedAt, now)}` : `file unavailable: ${work.file?.unavailable ?? 'not looked up'}`;
  return `    ${work.tool} ${id}${kind} ${JSON.stringify(work.description ?? '')}  launched ${ago(work.launchedAt, now)}  ${file}`;
}

/** `275k` for 275,400 tokens: the board is read at a glance, and the exact count is in `--json`. */
const thousands = (tokens) => `${Math.round(tokens / 1000)}k`;

function contextText(session, sizes) {
  const context = session.context ?? { unavailable: 'not read' };
  if (context.unavailable) return `context unavailable: ${context.unavailable}`;
  return `context ${sizes.of(context.tokens)}${session.pastContextLimit ? `, past the limit of ${sizes.limit}` : ''}`;
}

function sessionLines(session, now, sizes) {
  const id = session.id.slice(0, 8);
  // The session that asked for the board is marked: its own state is always "working", and a watch
  // leaves it out of what it compares.
  const self = session.self ? '  (this session)' : '';
  if (session.unavailable) return [`${id}  unavailable: ${session.unavailable}${self}`];
  const state = session.stateReason ? `${session.state} (${session.stateReason})` : session.state;
  const lines = [`${id}  ${state}  ${session.title ?? '(no title)'}  last entry ${ago(session.lastEntryAt, now)}${self}`];
  const recorded = (value) => value ?? 'unavailable: no entry records it';
  lines.push(`  cwd ${recorded(session.cwd)}  branch ${recorded(session.gitBranch)}  ${contextText(session, sizes)}`);

  if (session.work.length > 0) {
    const open = session.work.filter((work) => !work.ended);
    const ended = session.work.filter((work) => work.ended);
    // Every piece without a recorded end gets its own line; the ended ones are a count and the latest,
    // because a long session has hundreds and the board is read on a phone.
    // An end with no time is the latest only when no end has one; among equals the later in the list wins.
    const time = (work) => work.endedAt ?? '';
    const last = ended.reduce((latest, work) => (latest === null || time(work) >= time(latest) ? work : latest), null);
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
  return [title, ...(fact.items.length === 0 ? [`  ${empty}`] : fact.items.flatMap(itemLine)), ''];
}

const NEXT_STEP_LINES = 3;
const clipped = (line) => (line.length > TAIL_WIDTH ? `${line.slice(0, TAIL_WIDTH - 1)}…` : line);

/** The lines under a worktree for the plans of its branch: one per feature document with its steps and
 * what is pending, then the first lines of its next step. Nothing for a worktree with no such document. */
function planLines(plans) {
  if (plans === undefined) return [];
  if (!plans.available) return [`    plans unavailable: ${plans.reason}`];
  return plans.items.flatMap((plan) => {
    if (plan.unavailable) return [`    plan ${plan.path}  unavailable: ${plan.unavailable}`];
    const pending = plan.pending.length > 0 ? `pending ${plan.pending.join(', ')}` : 'nothing pending';
    const more = plan.nextStep.length - NEXT_STEP_LINES;
    return [
      `    plan ${plan.path}  ${plan.title}  ${plan.done}/${plan.total}  ${pending}`,
      ...plan.nextStep.slice(0, NEXT_STEP_LINES).map((line) => `      > ${clipped(line)}`),
      ...(more > 0 ? [`      > (${more} more line${more === 1 ? '' : 's'})`] : []),
    ];
  });
}

/** How many lines of the relief file the board prints: enough to see what the orchestrator noted last,
 * and whoever needs the rest reads the file. */
export const RELIEF_LINES = 5;

/** The text of an orchestrator's relief file as the board shows it: how many lines it holds and the last
 * `count` of them. It is one dated line per event, so a blank line is not one. */
export function reliefTail(text, count = RELIEF_LINES) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  return { lineCount: lines.length, lines: lines.slice(lines.length - Math.min(count, lines.length)) };
}

/** The `Relief` section: the file's path with its last lines, or that there is none yet (and where the
 * first line would create it), or why it could not be read. */
function reliefLines(relief) {
  if (relief.unavailable) return ['Relief', `  ${relief.path}  unavailable: ${relief.unavailable}`, ''];
  if (!relief.exists) return ['Relief', `  no relief file yet: the first line an orchestrator appends creates ${relief.path}`, ''];
  const shown = relief.lines.length;
  const count = relief.lineCount === 0 ? 'empty' : `${relief.lineCount} line${relief.lineCount === 1 ? '' : 's'}${shown < relief.lineCount ? `, the last ${shown}` : ''}:`;
  return ['Relief', `  ${relief.path}  ${count}`, ...relief.lines.map((line) => `  | ${clipped(line)}`), ''];
}

/** What a gate does, as its line in `Gates` says it. A `check` process the lock says nothing of is given
 * its start, as the listing has it. One that does not know the lock runs its sensors, as before there was
 * a lock. One that knows it is then not in its sensors, and its line says so, lest it be read as a gate
 * that runs; with no lock read (`lockRead` is false) nothing says where it is, and its line is the
 * listing's alone.
 *
 * `now` is the board's time, against which what the listing gives is said. `lockNow` is the time the lock
 * was read at, against which what the lock gives is said: when a gate took it or began to wait, and the
 * holder's last beat. */
function gateState(gate, now, lockRead, lockNow = now) {
  const { lock } = gate;
  if (!lock) {
    const started = gate.startedAt?.unavailable ? `start unavailable: ${gate.startedAt.unavailable}` : `started ${ago(gate.startedAt, now)}`;
    return lockRead && gate.knowsLock === true ? `not in its sensors (before or after them), ${started}` : started;
  }
  if (lock.role === 'waiter') {
    const whom = lock.for === null ? "the machine's gate lock" : `the gate of pid ${lock.for}`;
    return `waiting for ${whom}${lock.since === null ? '' : `, began ${ago(lock.since, lockNow)}`}`;
  }
  // A holder that stopped beating is not a gate that runs: it died or froze, and its lock is taken over.
  if (lock.stale) return `silent: holds the gate lock, its last beat was ${ago(lock.beatAt, lockNow)} and the next gate takes it over`;
  if (lock.beatAt === null) return 'holds the gate lock, and nothing more of it could be read';
  // A file whose beat was read and whose text was not (busy at that instant), or that is not a gate's.
  if (lock.since === null) return `running, holds the gate lock since an unknown time, its last beat was ${ago(lock.beatAt, lockNow)}`;
  return `running, took the gate lock ${ago(lock.since, lockNow)}`;
}

/** The `Gates` section: a line per gate of `boardGates`, the one that runs first and then those that
 * wait; `none running` for none; and under them whichever of the two sources could not be read, with
 * the reason, since the gates above it are then what the other source alone could tell.
 *
 * What the lock says of a gate is said against the clock the lock was read with (`gateLock.readAt`), not
 * against `now`, the time the board began: the lock is read last, after reads that take seconds, and
 * whether its holder is silent was judged at that moment. Said against the earlier time, a holder read as
 * silent, a minute after its last beat, was shown with a last beat of under a minute (found in review,
 * 2026-10-10). A board that does not say when its lock was read is said against `now` throughout. */
function gateLines(board, now) {
  const lockRead = board.gateLock?.available === true;
  const readAt = Date.parse(board.gateLock?.readAt ?? '');
  const lockNow = Number.isNaN(readAt) ? now : readAt;
  const lines = boardGates(board).map((gate) => {
    const worktree = gate.worktree?.unavailable ? `worktree unavailable: ${gate.worktree.unavailable}` : gate.worktree;
    const command = isProcess(gate) ? gate.commandLine : `${gate.lock.command ?? 'command unknown'} (${gate.commandLine.unavailable})`;
    return `  ${gate.pid === null ? 'pid unknown' : `pid ${gate.pid}`}  ${worktree}  ${gateState(gate, now, lockRead, lockNow)}  ${command}`;
  });
  if (!board.gates.available) lines.push(`  unavailable: ${board.gates.reason}`);
  else if (lines.length === 0) lines.push('  none running');
  if (board.gateLock && !board.gateLock.available) lines.push(`  unavailable: ${board.gateLock.reason}`);
  return ['Gates', ...lines, ''];
}

/** The board as lines of text: the sessions (in the order given, most recent first), then worktrees,
 * the gates that run and wait, open pull requests and the orchestrator's relief file, and a last line
 * that says what the board cannot see. */
export function renderBoard(board, { now }) {
  const lines = [`Sessions  ${board.root}  ${board.sessions.length} changed in the last ${board.hours}h`, ''];
  const sizes = contextSizes(board);
  for (const session of board.sessions) lines.push(...sessionLines(session, now, sizes), '');

  lines.push(
    ...sectionLines('Worktrees', board.worktrees, 'none', (tree) => {
      const upstream = tree.aheadOfUpstream === 'no upstream' ? 'no upstream' : counted(tree.aheadOfUpstream, 'not pushed');
      const line = `  ${tree.path}  ${tree.branch ?? (tree.bare ? '(bare)' : '(detached)')}  ${(tree.head ?? '').slice(0, 7)}  ${counted(tree.aheadOfMain, 'not on origin/main')}, ${upstream}, ${counted(tree.changed, 'changed')}`;
      return [line, ...planLines(tree.plans)];
    }),
    ...gateLines(board, now),
    ...sectionLines('Pull requests', board.pullRequests, 'none open', (pr) => `  #${pr.number}  ${pr.title}  (${pr.branch})`),
    ...(board.relief ? reliefLines(board.relief) : []),
    NOT_VISIBLE,
  );
  return lines;
}
