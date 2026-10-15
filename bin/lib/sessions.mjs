// Pure facts for `bin/sessions.mjs` — see odd/tasks/session-board.md (## Design records the transcript
// format this file reads, established from real transcripts). No fs and no process here: a transcript's
// text goes in and session facts come out, and every external command is a `run` the caller hands in,
// so the tests use inline synthetic transcripts and fake commands, never this machine's sessions.
import path from 'node:path';
import { parseSnapshot } from './process-tree.mjs';
import { parseFeature, tokenize } from './progress.mjs';
import { ruleValue } from './rules.mjs';

const TITLE_LENGTH = 60;

// ---- the context figures ------------------------------------------------------------------------------
//
// Every statement the board makes about a context comes from the three figures below, and each says where
// it comes from. None of them is in a transcript as a figure (no entry of this project's transcripts holds
// the window or the compaction point as a number, 2026-10-11), so each is a default a flag can replace.

/** The window a context is a share of, in tokens: the 500,000 the desktop app reports for a session
 * (odd/tasks/session-channel.md, "Context"). It belongs to the model and the app, so it is a default
 * (`--context-window`), not a constant. */
export const DEFAULT_CONTEXT_WINDOW = 500000;

/** Where the host compacts a session by itself, as a whole share of the window: the share the app
 * reports. Six automatic compactions of this project's transcripts fired between 466,887 and 468,151
 * tokens, just above it; a seventh fired at 524,781 (2026-10-09, host 2.1.293) in a session whose reply
 * before it was sent with 523,422, so the point is not the same for every session. That is why a
 * transcript's own measure wins (`sessionFacts`, `contextCompaction`) and this is only what is said of a
 * session that has measured none (`--context-compaction`).
 *
 * This line is the one home of the number: a message, a usage text, a comment or a document that says
 * where the host compacts reads this constant or names it, and none writes the value again
 * (bin/sessions.test.mjs holds the texts of this feature to that). */
export const DEFAULT_CONTEXT_COMPACTION_PERCENT = 93;

/** The context pause, as a whole share of the window: the user's rule. No session stops, slows or
 * proposes a cut for a percentage; at this share it pauses, writes its state in its feature document and
 * judges whether what is left fits before the compaction. It limits nothing: it is where the board says
 * so and where a watch wakes (`--context-pause`).
 *
 * The one home of the number is its declared rule, `context-pause` of ./rules-data.mjs: the rule changed
 * more than once, and every text that had written its value kept the old one. So the rule is named ("the
 * context pause") or read from this constant, and its value is written nowhere but in its declaration. */
export const DEFAULT_CONTEXT_PAUSE_PERCENT = ruleValue('context-pause', 'percent of the context window');

/** The last notice before the host compacts, as a whole share of the window: three points under the compaction, a
 * last turn to write the state and the resume prompt. Read from the compaction, so it moves with it. */
export const DEFAULT_CONTEXT_LAST_PERCENT = DEFAULT_CONTEXT_COMPACTION_PERCENT - 3;

/** `percent` of `window`, in whole tokens: half of 500,000 is 250,000. */
export function shareOf(window, percent) {
  return Math.round((window * percent) / 100);
}

/** `tokens` as a whole percentage of `window`: the number the desktop app shows for a context. */
export function percentOf(tokens, window) {
  return Math.round((tokens / window) * 100);
}
const NOTIFICATION_PATTERN = /<task-notification>([\s\S]*?)<\/task-notification>/g;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// The line of each entry `parseTranscript` read, from 1 (empty and broken lines count). A question names the line
// of its call and of its answer, so the board can say where he answered. A weak map: no entry is changed by it.
const LINE_OF = new WeakMap();

/** A transcript's entries, one JSON object per line. A line that does not parse, or that parses to
 * something other than an object (`null`, a number, a string, a list), is skipped and counted, never
 * fatal: a session appends to its transcript while the board reads it, so the last line may be half
 * written, and nothing below has to ask whether an entry is one. */
export function parseTranscript(text) {
  const entries = [];
  let skipped = 0;
  for (const [index, line] of text.split('\n').entries()) {
    if (line.trim() === '') continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      skipped += 1;
      continue;
    }
    if (isObject(entry)) {
      entries.push(entry);
      LINE_OF.set(entry, index + 1);
    } else skipped += 1;
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

/** A user entry's text when somebody typed it: not a meta entry (which is also what the host makes of a
 * message from another session, `isPeerMessage`), not a compaction summary, not a notification or a
 * command wrapper (those start with a tag). `null` otherwise. */
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

/** The command the host queued while the session worked and wrote as `entry`, `{ attachment, origin, kind
 * }`, or `null` for an entry that holds none. The host does not write what arrives mid-turn as a `user`
 * entry: it writes an entry of type `attachment` whose attachment is a `queued_command`, with the text in
 * `prompt` and the marks a `user` entry carries on itself (`origin`, `isMeta`) inside the attachment. It
 * queues the same way a prompt of the person, a message from another session and the end of a task, so
 * the type alone says nothing of whose it is: `kind` does. It is `'task-notification'` for the end of a
 * task, which the host says in the origin or, on the ones that record no origin, in `commandMode`; and
 * the origin's own kind for anything else, `undefined` when it records none. */
function queuedCommandOf(entry) {
  const attachment = entry.attachment;
  if (entry.type !== 'attachment' || !isObject(attachment) || attachment.type !== 'queued_command') return null;
  const origin = isObject(attachment.origin) ? attachment.origin : {};
  const notification = origin.kind === 'task-notification' || attachment.commandMode === 'task-notification';
  return { attachment, origin, kind: notification ? 'task-notification' : origin.kind };
}

/** Who gave the instruction `entry` is, `'person'` or `'session'`, or `null` when it is none: what starts
 * a task for the board (`sessionFacts`, `lastTask`). The person's is a prompt (`promptText`) or anything
 * else the host marks as sent by a person, which is a paste with nothing typed beside it (`origin.kind:
 * "human"`; 24 of the 583 such entries of this project's transcripts start with a tag, 2026-10-11). A
 * session's is a message from another session, which the app may deliver for one (`peerMessageOf`). A subagent's
 * hand-back, what the app puts in, a task
 * notification and the result of a tool are part of the work an instruction started, not a new one.
 *
 * An instruction that arrives while the session works is a queued command (`queuedCommandOf`) and no
 * `user` entry: it is told by the same origins, read where the attachment keeps them. Read as no
 * instruction, it left the work after it with the task before, which then cost more than it did. */
function instructionBy(entry) {
  if (entry.isSidechain) return null;
  const queued = queuedCommandOf(entry);
  if (queued) {
    if (queued.kind === 'peer') return peerMessageOf(entry).from === 'session' ? 'session' : null;
    return queued.kind === 'human' && !queued.attachment.isMeta ? 'person' : null;
  }
  if (entry.type !== 'user') return null;
  if (isPeerMessage(entry)) return peerMessageOf(entry).from === 'session' ? 'session' : null;
  if (promptText(entry) !== null) return 'person';
  return !entry.isMeta && isObject(entry.origin) && entry.origin.kind === 'human' ? 'person' : null;
}

/** Whether `entry` is a message that did not come from the person: a user entry whose `origin.kind` is
 * `peer`. That is how the host writes what another session sent, what a subagent hands back to its
 * parent and what the app itself put in, which includes a message the app delivers for a session (`peerSender`).
 * It marks every one of them `isMeta` (185 of 185 in this
 * project's transcripts, 2026-10-11), which is what keeps such a message from being read as a prompt
 * somebody typed (`promptText`), and so from ever being a session's title. */
const isPeerMessage = (entry) => entry.type === 'user' && isObject(entry.origin) && entry.origin.kind === 'peer';

/** The opening of a message the app delivers for a session: the sentence the desktop app's own tool puts before
 * its wrapper, then the wrapper's opening tag, whose attributes `attributeOf` reads. */
const DELIVERED_OPENING = /^\s*Another Claude session sent a message:\s*<cross-session-message(\s[^>]*)>/;
const XML_ENTITIES = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" };

/** The value of attribute `name` in the attributes of an opening tag, with its XML entities decoded in one
 * pass (so `&amp;quot;` reads as `&quot;`), or `undefined` when the tag has no such attribute. */
const attributeOf = (attributes, name) => {
  const value = new RegExp(`\\s${name}="([^"]*)"`).exec(attributes)?.[1];
  return value === undefined ? undefined : value.replace(/&(quot|amp|lt|gt|apos);/g, (_, entity) => XML_ENTITIES[entity]);
};

/** The sender a message the app delivers for a session names in its wrapper, `{ name }` (the title, `null` when the
 * wrapper gives none), for a text that begins with that wrapper and gives a `from`. `null` for any other text: the
 * app's own message, which no session is known to have sent. */
function deliveredBy(text) {
  const opening = DELIVERED_OPENING.exec(text);
  if (opening === null || attributeOf(opening[1], 'from') === undefined) return null;
  return { name: attributeOf(opening[1], 'name') || null };
}

/** The text of the entry that holds a peer message: a queued command's `prompt`, or a `user` entry's content as
 * `quoteEntry` reads it (the string, or its text blocks joined), `''` when it has none. */
function peerTextOf(entry) {
  if (entry.type === 'attachment') return typeof entry.attachment.prompt === 'string' ? entry.attachment.prompt : '';
  const content = entry.message?.content;
  return typeof content === 'string' ? content : blocksOf(entry).filter(isText).map((block) => block.text).join('\n');
}

/** Who sent what an origin of kind `peer` marks, given the text of its entry: `'subagent'` for a hand-back,
 * `'host'` for a message the app put in, and `'session'`, another session, for every other.
 *
 * A hand-back is an origin with `handback: true` or one that names the sub-agent by `senderTaskId`, a string,
 * which no origin of another session carries. In this project's transcripts (262 transcripts, 2026-10-11), of
 * the origins of kind `peer`: 280 from another session carry `fromSession`, `name` and `msg_id` and no
 * `senderTaskId`; 19 hand-backs carry `handback: true` with `senderTaskId`; and 1 queued command carries
 * `senderTaskId` and `name` with no `handback`, which the rule reads as a hand-back.
 *
 * A message the app delivers for a session is an origin with `hostInjected: true` whose text begins with the
 * wrapper that names the sender (`deliveredBy`), and it is `'session'`. Counted on 2026-10-12 over this
 * project's 57 transcripts, each entry once by its `uuid`: 147 origins carry `hostInjected: true` (144 on `user`
 * entries, 3 in queued commands), and the text of all 147 begins with that wrapper. Read as the app's own, an
 * instruction of an orchestrator started no task and its sender was lost. Each of these origins says the same on
 * a `user` entry and inside a queued command, and so does its text. */
const peerSender = (origin, text) => {
  if (origin.handback === true || typeof origin.senderTaskId === 'string') return 'subagent';
  if (origin.hostInjected !== true) return 'session';
  return deliveredBy(text) === null ? 'host' : 'session';
};

/** The peer message `entry` holds as the board keeps it, `{ at, from, name, session, mode, id }`, or `null`
 * for an entry that holds none. `from` is `'session'` for another session, which gives its title in
 * `name`, its own id in `session` (the app's, which is not the name of a transcript), the permission mode
 * it runs in and the id of the message; `'subagent'` for a hand-back, and `'host'` for a message the app
 * put in, which give less. A message the app delivers for a session is `'session'` too: its title is the one its
 * wrapper names (`deliveredBy`), its `session` is the origin's `from`, and it has no `id`, since the host gives
 * none (147 such origins in this project's transcripts on 2026-10-12, counted at `peerSender`). What they do not
 * give is `null`. The text is read only to tell such a message apart, and is not kept:
 * the board says who wrote to whom, and the transcript has the rest.
 *
 * A message that arrives between two turns is a `user` entry (`isPeerMessage`), and one that arrives
 * while the session works is a queued command (`queuedCommandOf`) with the same origin inside the
 * attachment: both are read here, so a message is the same whichever way it came. Read from `user`
 * entries only, the board said of a message that it was not seen to arrive when its receiver's
 * transcript held it (46 queued commands of this project's transcripts name such a message, and none of
 * them is also a `user` entry, 2026-10-11). A queued message has its time on the entry, and on the
 * attachment when the entry has none. */
function peerMessageOf(entry) {
  const queued = queuedCommandOf(entry);
  const origin = queued === null ? (isPeerMessage(entry) ? entry.origin : null) : queued.kind === 'peer' ? queued.origin : null;
  if (origin === null) return null;
  const given = (value) => (typeof value === 'string' ? value : null);
  const at = entry.timestamp ?? queued?.attachment.timestamp ?? null;
  const text = peerTextOf(entry);
  const from = peerSender(origin, text);
  // A message the app delivers for a session names its sender in the wrapper, and the origin's `from` is that session.
  const delivered = origin.hostInjected === true && from === 'session' ? deliveredBy(text) : null;
  if (delivered !== null) return { at, from, name: delivered.name, session: given(origin.from), mode: given(origin.fromMode), id: null };
  return { at, from, name: given(origin.name), session: given(origin.fromSession), mode: given(origin.fromMode), id: given(origin.msg_id) };
}

/** A peer message in words, for the answer that an entry is not what the person sent: who it is from, by
 * the one rule that tells them (`peerSender`), and whether it was queued while the session worked. */
function peerInWords(message, { queued = false } = {}) {
  if (message.from === 'subagent') return queued ? 'a queued hand-back of a subagent' : 'what a subagent handed back';
  const lead = queued ? 'a queued message' : 'a message';
  return message.from === 'host' ? `${lead} the app put in` : `${lead} from another session (${JSON.stringify(message.name ?? 'no name')})`;
}

/** What one entry says about the turn: `'working'` (a tool call, a tool result, a prompt, a notification
 * or a message from another session that the session has not answered yet, a message still being
 * written), `'ended'` (a reply that closes its message, an interruption, the output of a local command, a
 * compaction summary), or `null` when the entry does not take part (side chains, every other meta entry,
 * everything that is neither a user nor an assistant entry).
 *
 * A peer message is a meta entry and still starts a turn: every one in this project's transcripts is
 * followed by a reply, 9 seconds later at the median and 99 at the most. Left out like the other meta
 * entries, it showed a session as waiting while it was answering. */
function turnOf(entry) {
  if (entry.isSidechain) return null;
  if (isPeerMessage(entry)) return 'working';
  if (entry.isMeta) return null;
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

/** How an interruption ended a turn: `'refused'` when a tool call was refused, `'interrupted'` when the turn was
 * stopped, `null` for an entry that is no interruption. The host writes the same text when another session stops
 * this one, so it says how the turn ended and never who ended it. */
function stopOf(entry) {
  if (entry.type !== 'user') return null;
  const text = blocksOf(entry).find((block) => isText(block) && block.text.startsWith('[Request interrupted'))?.text;
  if (text === undefined) return null;
  return text.startsWith('[Request interrupted by user for tool use]') ? 'refused' : 'interrupted';
}

/** The words of a stop (`stopOf`), for the board and the watch. */
const STOP_WORDS = { refused: 'a tool call of it was refused', interrupted: 'its turn was interrupted' };
const STOPPED_BY = "by the user or by another session's stop";
const stopWords = (stopped) => `${STOP_WORDS[stopped.how]}, ${STOPPED_BY}`;

/** Whether `entry` is a reply of the session itself: an assistant entry that is no side chain's and that
 * the harness did not write in the session's place (model `<synthetic>`). It is what answers an
 * instruction (`sessionFacts`, `lastTask`), whether or not it records what it was sent with (`contextOf`). */
const isOwnReply = (entry) => entry.type === 'assistant' && !entry.isSidechain && isObject(entry.message) && entry.message.model !== '<synthetic>';

/** The context a reply was sent with, `{ tokens, model, at }`: its input tokens plus what it read from
 * and wrote to the prompt cache, which together are everything the model was given for that reply (the
 * harness's own count at a compaction is within half a percent of it). `null` for an entry that is not
 * the session's own reply with usage: a side chain, a message the harness wrote itself (model
 * `<synthetic>`, all zeros), an entry with no usage. */
function contextOf(entry) {
  if (!isOwnReply(entry)) return null;
  const usage = entry.message.usage;
  if (!isObject(usage) || !Number.isFinite(usage.input_tokens)) return null;
  const counted = (value) => (Number.isFinite(value) ? value : 0);
  const tokens = usage.input_tokens + counted(usage.cache_read_input_tokens) + counted(usage.cache_creation_input_tokens);
  if (tokens <= 0) return null;
  return { tokens, model: typeof entry.message.model === 'string' ? entry.message.model : null, at: entry.timestamp ?? null };
}

/** What a compaction's own entry says, `{ before, after, automatic, at }`, or `null` for any other entry.
 * The host writes one `compact_boundary` per compaction, with the tokens the session held before it and
 * after it and what set it off (`trigger`: `auto` when the host did, `manual` when the user asked; 40 of
 * 40 in this project's transcripts carry the three, 2026-10-11). A count that is not a number is `null`. */
function compactionOf(entry) {
  if (entry.type !== 'system' || entry.subtype !== 'compact_boundary') return null;
  const counted = (value) => (Number.isFinite(value) ? value : null);
  const said = isObject(entry.compactMetadata) ? entry.compactMetadata : {};
  return { before: counted(said.preTokens), after: counted(said.postTokens), automatic: said.trigger === 'auto', at: entry.timestamp ?? null };
}

/** Whether a user entry only carries tool results: the host writes a call's result as such an entry, and it is no prompt. */
const isToolResultCarrier = (entry) => {
  const blocks = blocksOf(entry);
  return blocks.length > 0 && blocks.every((block) => block.type === 'tool_result');
};

/** How a session was opened, read from its first prompt: `'scheduled'` for a scheduled run, `'command'` for one the SDK
 * CLI or the CLI opened, `'his'` for one he typed in the desktop app, `'session'` for the first prompt the SDK gave a
 * session, else `'unknown'`. A scheduled run is checked first: it can come from the SDK CLI too. */
function openerOf(entry) {
  if (entry.turnOrigin === 'scheduled' || entry.origin?.subkind === 'scheduled-trigger') return 'scheduled';
  if (entry.entrypoint === 'sdk-cli' || entry.entrypoint === 'cli') return 'command';
  if (entry.turnOrigin === 'human' && entry.entrypoint === 'claude-desktop') return 'his';
  if (entry.turnOrigin === 'sdk' && entry.turnPosition?.promptIndex === 0) return 'session';
  return 'unknown';
}

/** What the stretch of work `stretch` cost, as the board keeps a task: `{ tokens, startedBy, startedAt,
 * endedAt, compactions }`, or `{ unavailable }` with the reason when the transcript does not say.
 * `tokens` is how much the context grew from the instruction that started it to its last reply, added up
 * on both sides of a compaction, and never below zero: the host drops what a context no longer needs. */
function taskOf(stretch) {
  if (stretch.blind) return { unavailable: 'a compaction inside its last task does not record the size before it' };
  if (stretch.replies === 0) return { unavailable: 'no reply of its last task records its token usage' };
  return { tokens: Math.max(0, stretch.grown + stretch.last - stretch.base), startedBy: stretch.by, startedAt: stretch.startedAt, endedAt: stretch.endedAt, compactions: stretch.compactions };
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

// The kinds of recipient a `SendMessage` call names for another session: its title, or its own address.
// The third, `agent`, is a subagent of the session that calls.
const SESSION_RECIPIENTS = new Set(['name', 'session']);

// The longest summary of a sent message the board keeps. Every `SendMessage` call of this project's
// transcripts gives one (290 of 290, 2026-10-11), and the 182 sent to a session run from 17 to 69 characters.
const SUMMARY_LENGTH = 100;

/** The message a `SendMessage` call sends to another session, before its result is known (`sessionFacts`).
 * `summary` is the line the call itself gives about the message, flattened to one line and cut at
 * `SUMMARY_LENGTH`, or `null` when it gives none: it is what the sender said the message is about, and
 * the only words of a message the board keeps. The message itself stays in the transcript. */
function sentMessage(block, entry) {
  const given = (value) => (typeof value === 'string' ? value : null);
  const said = (given(block.input?.summary) ?? '').replace(/\s+/g, ' ').trim();
  const summary = said === '' ? null : said.length > SUMMARY_LENGTH ? `${said.slice(0, SUMMARY_LENGTH - 1)}…` : said;
  return { at: entry.timestamp ?? null, to: given(block.input?.to), toKind: given(block.input?.recipient_kind), id: null, failed: false, summary };
}

function end(work, at, status) {
  if (work.ended) return; // the first recorded end wins: the same notification is written more than once
  work.ended = true;
  work.endedAt = at ?? null;
  work.status = status;
}

/** When the person last wrote in `entries` (parsed transcript lines), a transcript's time, or `null`: by `quoteOf`'s
 * rule, with the answers to the session's question calls counted as theirs. The newest by its time, not the last in
 * the file: a resumed session writes older entries again after the newer ones, and an equal time keeps the later
 * entry. An entry with no time is not counted. It is what `askingRule` and `cutRule` read. */
export function personAtOf(entries) {
  const questionCalls = questionCallsOf(entries);
  let personAt = null;
  for (const entry of entries) {
    const quote = quoteEntry(entry, questionCalls);
    if (quote.person && typeof quote.at === 'string' && (personAt === null || quote.at >= personAt)) personAt = quote.at;
  }
  return personAt;
}

/** One session's facts from its transcript's text: `title` and where it came from, `lastEntryAt`, the
 * `cwd` and `gitBranch` its last entry records, its background `work` with each recorded end, the `state`
 * derived from those, the `tail` of its last reply (`tail` lines, default 3) and the lines skipped.
 *
 * Work is every `Agent` call, every `Bash` call that went to the background, and every `SendMessage`
 * call that resumed a subagent. Its id (the task id of a shell, the agent id of a subagent) comes from
 * the tool result that follows the call, never from the call itself, so work whose result is not written
 * yet has `id: null`. A foreground `Agent` call ends with its tool result; everything else ends with a
 * task notification that carries a status, or with the result of a `TaskStop` call that names it, whose
 * status is `stopped`.
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
 * `contextWindow` and `atContextPause` says whether it is at `contextPause` (tokens) or past it; both are
 * `null` when the context could not be read.
 *
 * `contextCompaction` is where the host compacts this session by itself, `{ tokens, measured, at }`: what
 * the session held at its own latest automatic compaction, with its time, when the transcript records one
 * (`compactionOf`), and otherwise `contextCompactionDefault` (tokens), with `measured: false`. The
 * session's own measure wins because the point is the host's and has not been the same for every session.
 *
 * `lastCompaction` is the session's newest compaction of any kind, `{ uuid, at, automatic, before }`, or `null`
 * when the transcript records none (`compactionOf`): what a watch tells when the host or the person compacts
 * the session. The newest is the one with the latest time, never the last in the file: the host writes a
 * boundary again with its `uuid` and time, and an older one again when it continues a session, so a copy
 * changes nothing. `uuid` is `null` for an entry that has none.
 *
 * `contextRoom` is what is left before it, in tokens: below zero for a session already past the point,
 * `null` with no context.
 *
 * `lastTask` is what the last task cost (`taskOf`). A task is the work one instruction started
 * (`instructionBy`: a prompt of the person, or a message from another session, also when it was sent
 * while the session worked) up to the next one, and an instruction that arrives before the one before it
 * was answered joins it. A reply of the session answers it (`isOwnReply`), with or without its usage: a
 * task whose replies record none has ended all the same, and its cost is not known. The last one is the
 * last that ended: the stretch the session just finished when it waits, and the one before while it
 * works on a stretch or has work open, whose cost nobody knows yet. `lastTaskFits` says whether a task of
 * that cost still fits in `contextRoom`, and is `null` when either is not known. What a transcript cannot
 * show: which instruction was a whole task and which a one-word answer in the middle of one (each starts
 * a stretch), what a subagent spent in a context of its own, and what the next task will cost.
 *
 * A resumed session writes its earlier entries again, with their ids: an entry seen before starts no
 * task, costs nothing and measures no compaction a second time.
 *
 * `permissionMode` is the one the last user entry that records it has (`bypassPermissions`, `auto`), and
 * `null` when none does: the host delivers a message only between sessions of one class, so it says
 * which sessions can ring each other.
 *
 * `received` is every peer message the transcript holds (`peerMessageOf`), whether it arrived between
 * two turns or while the session worked, in the order written, and
 * `sent` every `SendMessage` call to another session, as `{ at, to, toKind, id, failed, summary }`: the
 * address it was sent to, as the call gives it (a title, or a session's own address), the kind of
 * recipient the call names (`name`, `session`, or `null` from a host that named none), the id the host
 * returned for the message, whether the call failed, and the line the call gives about the message
 * (`sentMessage`). `id` is `null` until the result is written, and when the result gives none. A
 * follow-up to a subagent is not one of them: it is work (`resumedWork`), or nothing. A resumed session
 * writes earlier entries again, so each message is listed once.
 *
 * `pendingCall` is the last tool call of the session's own chain that no tool result names, `{ id, tool, at }`
 * with the time of its entry, or `null` when every call has its result. It is a plain fact for any tool, a
 * question tool included: what the board says of a call that waits too long is `sessionLines`' rule.
 *
 * `personAt` is the time of the newest entry the person wrote, by `quoteOf`'s rule with the question calls of
 * the transcript, so a typed message, a queued one and a tapped answer count; `null` when none has a time.
 *
 * `opened` is how the session was opened (`openerOf`, read from its first prompt, `'unknown'` when there is none);
 * `effort` is the effort of its last reply that records one, `null` when none does. */
export function sessionFacts(
  text,
  {
    tail = 3,
    contextWindow = DEFAULT_CONTEXT_WINDOW,
    contextPause = shareOf(contextWindow, DEFAULT_CONTEXT_PAUSE_PERCENT),
    contextCompactionDefault = shareOf(contextWindow, DEFAULT_CONTEXT_COMPACTION_PERCENT),
  } = {},
) {
  const { entries, skipped } = parseTranscript(text);
  const written = new Set(); // the ids of the entries read so far: a resumed session writes them again
  let held = null; // the tokens the session holds, by the entries read once
  let stretch = null; // the work the last instruction started
  let finished = null; // the stretch before it
  let measured = null; // the session's latest automatic compaction, `{ tokens, at }`
  let lastCompaction = null; // the session's newest compaction of any kind, `{ uuid, at, automatic, before }`
  const calls = new Map(); // tool_use id -> the tool_use block, the entry that holds it and that entry's index
  const workByCall = new Map(); // tool_use id -> work
  const endsByTask = new Map(); // task id -> the latest end that closed nothing, and the index of its entry
  const launchIndex = (work) => calls.get(work.toolUseId).index;
  const received = new Map(); // the message's id, or its entry's when it has none -> the message
  const sentByCall = new Map(); // tool_use id -> the message that call sent to another session
  const answered = new Set(); // the tool_use ids that a tool result of the transcript names
  let permissionMode = null;
  let customTitle = null;
  let firstPrompt = null;
  let lastEntryAt = null;
  let cwd = null;
  let gitBranch = null;
  let turn = null;
  let turnEndedAt = null;
  let stoppedHow = null;
  let lastReply = null;
  let context = null;
  let opened = null; // how the session was opened, by its first prompt (`openerOf`)
  let effort = null; // the effort of the session's last reply that records one

  for (const [index, entry] of entries.entries()) {
    context = contextOf(entry) ?? context;
    // A compaction replaces the context: until the next reply the harness's own count is all there is.
    if (entry.type === 'system' && entry.subtype === 'compact_boundary' && Number.isFinite(entry.compactMetadata?.postTokens)) {
      context = { tokens: entry.compactMetadata.postTokens, model: context?.model ?? null, at: entry.timestamp ?? null };
    }
    const repeated = typeof entry.uuid === 'string' && written.has(entry.uuid);
    if (typeof entry.uuid === 'string') written.add(entry.uuid);
    if (!repeated) {
      const compaction = compactionOf(entry);
      // The newest by its time, not by its place: a resumed session writes an older boundary again after the
      // newer one, and an equal time keeps the later entry, as `measured` does. A side chain's is a sub-agent's
      // own, as `boundariesOf` reads it: the session was not compacted by it.
      if (compaction && !entry.isSidechain && (lastCompaction === null || (compaction.at ?? '') >= (lastCompaction.at ?? ''))) {
        lastCompaction = { uuid: typeof entry.uuid === 'string' ? entry.uuid : null, at: compaction.at, automatic: compaction.automatic, before: compaction.before };
      }
      const sentWith = compaction ? null : contextOf(entry);
      const by = compaction || sentWith ? null : instructionBy(entry);
      // A reply answers the instruction before it even when it records no usage: counted by the replies
      // with usage, such a task stayed open, and the next instruction joined a task that had ended.
      if (stretch && isOwnReply(entry)) stretch.answered = true;
      if (compaction) {
        if (compaction.automatic && compaction.before !== null && (measured === null || (compaction.at ?? '') >= (measured.at ?? ''))) measured = { tokens: compaction.before, at: compaction.at };
        if (stretch && (compaction.before === null || compaction.after === null)) stretch.blind = true;
        else if (stretch) {
          if (stretch.base !== null) stretch.grown += Math.max(0, compaction.before - stretch.base);
          stretch.base = compaction.after;
          stretch.last = compaction.after;
          stretch.compactions += 1;
        }
        held = compaction.after ?? held;
      } else if (sentWith) {
        if (stretch) {
          stretch.base ??= sentWith.tokens; // the first stretch of a transcript is counted from its first reply
          stretch.last = sentWith.tokens;
          stretch.endedAt = sentWith.at;
          stretch.replies += 1;
        }
        held = sentWith.tokens;
      } else if (by && !(stretch && !stretch.answered)) {
        finished = stretch;
        // A queued instruction has its time on the entry, and on the attachment when the entry has none.
        stretch = { by, startedAt: entry.timestamp ?? entry.attachment?.timestamp ?? null, base: held, grown: 0, last: held, endedAt: null, answered: false, replies: 0, compactions: 0, blind: false };
      }
    }
    if (entry.type === 'custom-title' && typeof entry.customTitle === 'string') customTitle = entry.customTitle;
    if (typeof entry.timestamp === 'string' && (lastEntryAt === null || entry.timestamp > lastEntryAt)) lastEntryAt = entry.timestamp;
    if (typeof entry.cwd === 'string') cwd = entry.cwd;
    if (typeof entry.gitBranch === 'string') gitBranch = entry.gitBranch;
    if (entry.type === 'user' && typeof entry.permissionMode === 'string') permissionMode = entry.permissionMode;
    const message = entry.isSidechain ? null : peerMessageOf(entry);
    if (message !== null) {
      // A message with no id of its own (a hand-back, one from the host) is told by the entry that holds it.
      const key = message.id !== null ? `message ${message.id}` : `entry ${typeof entry.uuid === 'string' ? entry.uuid : index}`;
      if (!received.has(key)) received.set(key, message);
    }
    firstPrompt ??= promptText(entry);
    // A compaction before the first prompt means the transcript continues a session whose opening prompt it lost: the
    // first message after it is a later turn and says nothing of how the session was opened.
    const compacted = entry.isCompactSummary === true || (entry.type === 'system' && entry.subtype === 'compact_boundary');
    if (opened === null && compacted) opened = 'unknown';
    if (opened === null && entry.type === 'user' && !entry.isMeta && !isToolResultCarrier(entry)) opened = openerOf(entry);
    if (isOwnReply(entry) && typeof entry.effort === 'string') effort = entry.effort;
    const said = turnOf(entry);
    if (said !== null) {
      turn = said;
      turnEndedAt = said === 'ended' ? (entry.timestamp ?? null) : null;
      stoppedHow = said === 'ended' ? stopOf(entry) : null;
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
        else if (block.name === 'SendMessage' && SESSION_RECIPIENTS.has(block.input?.recipient_kind)) sentByCall.set(block.id, sentMessage(block, entry));
      }
      if (entry.type === 'user' && block.type === 'tool_result') answered.add(block.tool_use_id);
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
        // A call that named no kind of recipient went to a session when its result returns a message id.
        let message = sentByCall.get(block.tool_use_id);
        if (!message && typeof outcome.msg_id === 'string') sentByCall.set(block.tool_use_id, (message = sentMessage(launch.block, launch.entry)));
        if (message) {
          if (typeof outcome.msg_id === 'string') message.id = outcome.msg_id;
          if (block.is_error === true) message.failed = true;
        }
      } else if (launch.block.name === 'TaskStop') {
        // A task stopped by hand: the result of the call is the only thing a transcript records of it (no
        // notification follows: none for the ten stopped shells of this project's transcripts,
        // 2026-10-11). It ends the work of that id launched before the call, and no other: a resumed
        // session writes the stop again, after work that started later under the same id. What it says is
        // that the host stopped the task, not that its process is gone: the process listing says that.
        const task = typeof outcome.task_id === 'string' ? outcome.task_id : launch.block.input?.task_id;
        if (block.is_error !== true && typeof task === 'string') {
          for (const item of workByCall.values()) if (item.id === task && launchIndex(item) < launch.index) end(item, entry.timestamp, 'stopped');
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

  // The last call of the session's own chain that no result names: what it waits on, if anything. The calls
  // are in the order of the file, so the last one left open is the last one asked.
  let pendingCall = null;
  for (const [id, launch] of calls) if (!answered.has(id)) pendingCall = { id, tool: launch.block.name, at: launch.entry.timestamp ?? null };
  const work = [...workByCall.values()];
  const state = turn === null ? 'unknown' : turn === 'working' ? 'working' : work.some((item) => !item.ended) ? 'background' : 'waiting';
  const compactsAt = measured === null ? { tokens: contextCompactionDefault, measured: false, at: null } : { tokens: measured.tokens, measured: true, at: measured.at };
  const room = context === null ? null : compactsAt.tokens - context.tokens;
  const personAt = personAtOf(entries);
  let lastTask;
  if (stretch === null) lastTask = { unavailable: 'the transcript holds no prompt of a person and no message from another session' };
  else if (state === 'waiting') lastTask = taskOf(stretch);
  else lastTask = finished === null ? { unavailable: 'its first task has not ended' } : taskOf(finished);
  const facts = {
    title: customTitle ?? (firstPrompt === null ? null : oneLine(firstPrompt)),
    titleSource: customTitle !== null ? 'custom-title' : firstPrompt !== null ? 'first-prompt' : null,
    lastEntryAt,
    personAt,
    cwd,
    gitBranch,
    permissionMode,
    opened: opened ?? 'unknown',
    effort,
    received: [...received.values()],
    sent: [...sentByCall.values()],
    context: context ?? { unavailable: 'no reply of the transcript records its token usage' },
    contextPercent: context === null ? null : percentOf(context.tokens, contextWindow),
    atContextPause: context === null ? null : context.tokens >= contextPause,
    contextCompaction: compactsAt,
    lastCompaction,
    questions: questionsOf(entries),
    contextRoom: room,
    lastTask,
    lastTaskFits: room === null || lastTask.unavailable !== undefined ? null : lastTask.tokens <= room,
    state,
    turnEndedAt,
    // A turn the person refused or stopped, while the session has not acted since: it waits for them.
    // Work it launched may still run (state `background`): the turn is stopped all the same.
    stopped: turn === 'ended' && stoppedHow !== null ? { how: stoppedHow, at: turnEndedAt } : null,
    work,
    pendingCall,
    tail: tail > 0 && lastReply !== null ? lastReply.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.trim() !== '').slice(-tail) : [],
    skippedLines: skipped,
  };
  if (turn === null) facts.stateReason = 'the transcript holds no prompt, reply or tool entry';
  return facts;
}

/** How long a tool call may have no result before the board says so, in ms. The host ends a foreground command
 * at ten minutes and its result arrives a few seconds later (601 to 606 s, of 9,100 Bash calls paired with their
 * results), so a call older than the cap plus a margin is held by the host for approval, or it hangs. */
export const PENDING_CALL_LIMIT_MS = 15 * 60 * 1000;

/** How long since he last wrote, in ms, under which he is taken to be there: a question is then put to him at once,
 * and past it the question waits for his next message (`askingRule`). The figure is the orchestrator's guess of
 * 2026-10-13, to be replaced by his own when he names one. */
export const PERSON_PRESENT_MS = 15 * 60 * 1000;

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

/** The main checkout of the repository `cwd` is in, so the project is the same from any worktree: for the
 * board, and for `notify`, whose record and relief file are the project's. Outside a repository (or
 * without git) the folder itself is the project, as it is for Claude Code.
 *
 * It is the folder that holds the common git dir when that dir is a `.git`: an ordinary checkout, and
 * every worktree linked to it. A common git dir of another name is kept apart from its checkout (a
 * submodule's is under the superproject's `.git/modules`, `--separate-git-dir` puts it anywhere) and its
 * place says nothing, so git is asked for the working tree: the one that git dir records, which a
 * submodule's does, and otherwise the one `cwd` is in when that is the main one, its git dir being the
 * common one. With neither (a bare repository; a worktree linked to a `--separate-git-dir` checkout,
 * which nothing in git ties to it) the project is the git dir itself, as it always was. */
export function mainCheckout(run, cwd) {
  const revParse = (args, folder) => {
    const result = run('git', ['rev-parse', ...args], { cwd: folder });
    return result.error || result.status !== 0 ? [] : result.stdout.split(/\r?\n/).filter((line) => line.trim() !== '');
  };
  const [common] = revParse(['--git-common-dir'], cwd);
  if (common === undefined) return cwd;
  const commonDir = path.resolve(cwd, common);
  if (path.basename(commonDir) === '.git') return path.dirname(commonDir);
  const [recorded] = revParse(['--show-toplevel'], commonDir);
  if (recorded !== undefined) return path.resolve(recorded);
  const [gitDir, top] = revParse(['--git-dir', '--show-toplevel'], cwd);
  return top !== undefined && path.relative(path.resolve(cwd, gitDir), commonDir) === '' ? path.resolve(top) : commonDir;
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

/** The id that starts a task's text (`T5`, `T3b`), or `null` when it has none. */
const taskId = (text) => /^([A-Za-z]{1,6}\d+[a-z]?)(?=[\s:]|$)/.exec(text)?.[1] ?? null;

/** One feature document as a plan: `{ path, title, done, total, pending, tasks, nextStep }`. Title and
 * checkboxes are `parseFeature`'s (bin/lib/progress.mjs), so the board counts what `js-harness progress`
 * counts. `pending` names each unchecked step by the id that starts it (`T5`, `T3b`), or by the start of
 * its text when it has none. `tasks` is the text of every step, ticked or not, as its checkbox line has
 * it: what a watch compares to tell a plan that changed from one that advanced (`taskDifferences`).
 * `nextStep` is every non-blank line of the `## Next step` section, all of them, because a watch compares
 * the whole text; the text board prints the first few. */
export function planOf(markdown, docPath) {
  const id = docPath.split('/').at(-1).replace(/\.md$/, '');
  const { title, done, total, steps } = parseFeature(markdown, id);
  const pending = steps
    .filter((step) => !step.done)
    .map((step) => taskId(step.text) ?? (step.text.length > PENDING_LENGTH ? `${step.text.slice(0, PENDING_LENGTH)}…` : step.text));
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
  return { path: docPath, title, done, total, pending, tasks: steps.map((step) => step.text), nextStep };
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
export function comparable(somePath) {
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

// ---- the roster: who is who ---------------------------------------------------------------------------
//
// A session's title is the address of its role (odd/tasks/session-channel.md, points 1, 4 and 5):
// `<project code> <role> · <what it does>`, the role being `ORQ` for the orchestrator or the number of a
// work session. The roster is the board's sessions again, one row per title, computed at each read and
// stored nowhere, so it is never older than the transcripts it comes from.

// One token for the code, one for the role, the dot between two spaces, and something after it. A title
// with a word more before the dot is another title: a handover names the orchestrator that arrives `ORQ
// nueva` and the one that leaves `ORQ relevada`, so that neither holds the role by its title.
const TITLE_SHAPE = /^(\S+) (ORQ|\d+) · (.*\S.*)$/;
const TITLE_WORDS = '<code> <role> · <what it does>';

/** What a title of the agreed shape says: `{ code, role, number, purpose }`, `role` being `'orchestrator'`
 * or `'work'` with the session's `number`, and `purpose` the text after the dot. `null` for any other
 * title, and for what is not one. */
export function roleOfTitle(title) {
  const shaped = typeof title === 'string' ? TITLE_SHAPE.exec(title) : null;
  if (!shaped) return null;
  const [, code, role, purpose] = shaped;
  if (role === 'ORQ') return { code, role: 'orchestrator', number: null, purpose: purpose.trim() };
  const number = Number(role);
  return Number.isSafeInteger(number) ? { code, role: 'work', number, purpose: purpose.trim() } : null;
}

/** The role `text` names, as `sessions --address` takes it: `orchestrator`, or `ORQ` as the titles spell
 * it, in any case, and the number of a work session in plain digits. `{ role, number }`, or `null`. */
export function roleNamed(text) {
  if (/^(orchestrator|orq)$/i.test(text)) return { role: 'orchestrator', number: null };
  const number = /^\d+$/.test(text) ? Number(text) : NaN;
  return Number.isSafeInteger(number) ? { role: 'work', number } : null;
}

/** Whether a session has a title it was given: the one its transcript carries (`custom-title`), or the
 * one of the opening it read (`reading`, `titledByReadings`). The start of a first prompt, which the
 * board shows for a session with neither, names nobody. */
export const hasTitle = (session) => (session.titleSource === 'custom-title' || session.titleSource === 'reading') && typeof session.title === 'string';

/** The title the record gives the session `id`: the one of the opening it read last (`readings`, the
 * readings of the record in the order written), or `null` when it read none. A reading is the session's
 * when its reader's id is the session's id or the start of it (`isSelf`), which is how `--self` names a
 * session and the rule by which a notice is its row's (`recordOfRows`). */
export function titleRead(readings, id) {
  if (typeof id !== 'string') return null;
  for (let index = readings.length - 1; index >= 0; index--) if (isSelf(id, readings[index].reader.id)) return readings[index].title;
  return null;
}

/** `sessions` (of a board) again, each session whose transcript carries no title given the one of the
 * opening it read (`titleRead`), with `titleSource: 'reading'`. That is every session opened from the
 * phone: its transcript has no `custom-title` entry (none in the two of this project, 2026-10-11), its
 * title lives in the app only, and the command by which it reads its opening is what says which session
 * it is. A title in the transcript wins: it is the one the app shows, and it can change after the
 * reading. The sessions given are not changed. */
export function titledByReadings(sessions, readings) {
  return sessions.map((session) => {
    if (session.unavailable || session.titleSource === 'custom-title') return session;
    const title = titleRead(readings, session.id);
    return title === null ? session : { ...session, title, titleSource: 'reading' };
  });
}

// The kinds of notice that say where a session is in its life: the last one of them is its place.
const STATUS_KINDS = new Set(['opened', 'waiting', 'closed', 'relieved']);
// Those after which nothing more comes from the session, by its own word.
const ENDED_KINDS = new Set(['closed', 'relieved']);

/** What the record says of each row of `rows`, as a `Map` from the row to `{ status, worktree, branch,
 * notices }`, with no entry for a row the record says nothing of. `status` is the last notice of the row
 * that is one of `opened`, `waiting`, `closed` and `relieved`, as `{ kind, at, text }` (the text says on
 * what a session waits, and who has the role of one that was relieved), or `null`. `worktree` and
 * `branch` are those of its last notice written from inside a worktree: where the command ran, which a
 * transcript does not record for a session that reached a worktree by `cd`. `notices` counts them.
 *
 * A notice is the row's when its sender's session id is the id of one of the row's transcripts, or the
 * start of one (`--self`); otherwise, when the title it carries is the row's. The id comes first because
 * it cannot be mistaken; the title is for a notice whose session the app has since restarted into a new
 * transcript, which carries the same title and another id. That is also why the id cannot tell two
 * sessions under one title apart: a restart and a twin both arrive with a new one. */
function recordOfRows(rows, notices) {
  const said = new Map();
  for (const notice of notices) {
    const { id, title } = notice.from ?? {};
    const byId = typeof id === 'string' && id !== '' ? rows.find((row) => row.transcripts.some((transcript) => isSelf(transcript.id, id))) : undefined;
    const row = byId ?? (typeof title === 'string' ? rows.find((item) => hasTitle(item) && item.title === title) : undefined);
    if (!row) continue;
    const kept = said.get(row) ?? { status: null, worktree: null, branch: null, notices: 0 };
    kept.notices += 1;
    if (STATUS_KINDS.has(notice.kind)) kept.status = { kind: notice.kind, at: notice.at, text: notice.text };
    if (typeof notice.worktree === 'string') {
      kept.worktree = notice.worktree;
      kept.branch = typeof notice.branch === 'string' ? notice.branch : null;
    }
    said.set(row, kept);
  }
  return said;
}

/** The roster of `sessions`, the sessions of a board: `{ rows, unread, outside }`.
 *
 * A row is a title, not a transcript: the app can restart a session's process, which goes on under its
 * title in a new transcript (seen on 2026-10-10; in this project's transcripts one title is carried by
 * up to four in a row), and nothing a transcript holds names the app session it belongs to. So every
 * transcript whose own title is that title is in the row, the latest first, each with its last entry.
 * The other side of it: two sessions that carry one same title are one row too, which the row cannot
 * tell and the roster's last line says (`ROSTER_NOT_KNOWN`). Only a title a session was given is one
 * (`hasTitle`): the one its transcript carries, or the one of the opening it read when its transcript
 * carries none (`titledByReadings`), and then the row's `titleSource` is `reading` unless another
 * transcript of the row carries the title. The start of a first prompt, which the board shows for a
 * session with neither, names nobody, and such a session is a row of its own, as is one with nothing to
 * show.
 *
 * A row has `title` and `titleSource`; what the title says, `code`, `role`, `number` and `purpose`
 * (`roleOfTitle`), all `null` for a title outside the shape; `self` when the session that asked is one of
 * its transcripts; `lastEntryAt`, the last entry of the latest; `permissionMode`, of the latest transcript
 * that records one; `opened`, the first opener of the earliest transcript that has one (`sessionFacts`), else
 * `scheduled` when a transcript's app record (`app`, a `Map` from a transcript's id to its record, as
 * `appSessions` gives it) names a scheduled task, else `unknown`; `where`, the app record's of the latest
 * transcript that has one, else `not-in-app` for a command and `unknown` otherwise; `effort`, the latest
 * transcript's that is a string, else the app record's, else `null`; `cwd` and `gitBranch`, together, of the
 * latest that records a folder; `worktree`, the one of `worktrees` (the board's) that folder is, or `null`;
 * `features`, the feature documents of that
 * worktree's branch (`readPlans`), named without folder or extension, when the worktree is still on the
 * branch the session recorded, and none otherwise; and `transcripts`, `[{ id, lastEntryAt }]`. The folder
 * is the one the entries record, which is where the session was opened: one that reaches a worktree by
 * `cd` still records the other, so neither `worktree` nor `features` says where a session works.
 *
 * `record` is what the channel's record says of the row's session (`recordOfRows`), from the notices of
 * the `record` handed in (`{ notices }`, as the record's reader gives it), and `null` for a row it says
 * nothing of, or with no record given. It replaces nothing: `cwd` stays what the transcript records.
 *
 * The orchestrator comes first, then the work sessions by number, then the rows with no role; among
 * equals the latest first. `unread` counts the transcripts that could not be read: they have no title,
 * so they are in no row.
 *
 * `since` (ms) is where the board's window starts. The board lists a transcript when its file changed in
 * the window, and a file changes without its session doing anything: the app appends entries with no
 * time to a transcript it opens (`cost-state`; on 2026-10-11 two transcripts whose last timed entry was
 * 13 and 14 days old were in a window of 12 hours). So a transcript is in a row, and holds a role, only
 * when its last timed entry is in the window; the others, and those with no timed entry at all, are
 * counted in `outside`. With no `since` every transcript given is in a row. */
export function rosterOf(sessions, { worktrees, since, record, app } = {}) {
  const trees = worktrees?.available ? worktrees.items : [];
  const groups = new Map();
  let unread = 0;
  let outside = 0;
  for (const session of sessions) {
    if (session.unavailable) {
      unread += 1;
      continue;
    }
    if (since !== undefined && !(Date.parse(session.lastEntryAt ?? '') >= since)) {
      outside += 1;
      continue;
    }
    const key = hasTitle(session) ? `title ${session.title}` : `transcript ${session.id}`;
    groups.set(key, [...(groups.get(key) ?? []), session]);
  }
  const recency = (item) => item.lastEntryAt ?? '';
  const latestFirst = (one, other) => (recency(one) < recency(other) ? 1 : recency(one) > recency(other) ? -1 : 0);
  const rows = [...groups.values()].map((group) => {
    const members = [...group].sort(latestFirst);
    const [latest] = members;
    const said = hasTitle(latest) ? roleOfTitle(latest.title) : null;
    const placed = members.find((member) => typeof member.cwd === 'string') ?? latest;
    const tree = typeof placed.cwd === 'string' ? trees.find((item) => comparable(item.path) === comparable(placed.cwd)) : undefined;
    const sameBranch = typeof placed.gitBranch === 'string' && tree?.branch === placed.gitBranch;
    // The app's record of the latest transcript that has one: where it sits, and its effort when no transcript records one.
    const latestRecord = members.map((member) => app?.get(member.id)).find((item) => item !== undefined) ?? null;
    const earliestOpener = [...members].reverse().find((member) => typeof member.opened === 'string' && member.opened !== 'unknown')?.opened;
    const scheduled = members.some((member) => typeof app?.get(member.id)?.scheduledTaskId === 'string');
    const opened = earliestOpener ?? (scheduled ? 'scheduled' : 'unknown');
    return {
      title: latest.title ?? null,
      // One transcript of the row that carries the title is enough for the row to have it from there.
      titleSource: members.some((member) => member.titleSource === 'custom-title') ? 'custom-title' : (latest.titleSource ?? null),
      code: said?.code ?? null,
      role: said?.role ?? null,
      number: said?.number ?? null,
      purpose: said?.purpose ?? null,
      self: members.some((member) => member.self === true),
      lastEntryAt: latest.lastEntryAt ?? null,
      permissionMode: members.find((member) => typeof member.permissionMode === 'string')?.permissionMode ?? null,
      opened,
      where: latestRecord?.where ?? (opened === 'command' ? 'not-in-app' : 'unknown'),
      effort: members.find((member) => typeof member.effort === 'string')?.effort ?? latestRecord?.effort ?? null,
      cwd: placed.cwd ?? null,
      gitBranch: placed.gitBranch ?? null,
      worktree: tree?.path ?? null,
      features: sameBranch && tree.plans?.available ? tree.plans.items.map((plan) => plan.path.split('/').at(-1).replace(/\.md$/, '')) : [],
      transcripts: members.map((member) => ({ id: member.id, lastEntryAt: member.lastEntryAt ?? null })),
      record: null,
    };
  });
  for (const [row, said] of recordOfRows(rows, record?.notices ?? [])) row.record = said;
  const rank = (row) => (row.role === 'orchestrator' ? 0 : row.role === 'work' ? 1 : 2);
  rows.sort((one, other) => rank(one) - rank(other) || (one.number ?? 0) - (other.number ?? 0) || latestFirst(one, other));
  return { rows, unread, outside };
}

/** The rows of `roster` that hold the role `wanted` (`roleNamed`): none, the one whose title is the
 * role's address, or several, and then a message to the role has no single address. */
export function roleHolders(roster, wanted) {
  return roster.rows.filter((row) => row.role === wanted.role && row.number === wanted.number);
}

// ---- the channel: what the sessions told each other ---------------------------------------------------
//
// Two sources, kept apart because they say different things (odd/tasks/session-channel.md, points 2 and
// 3). The record is the file `notify` writes: every notice is in it, with its text, whoever it was for
// and whether or not anybody was rung. The messages between sessions are the doorbell, read from the
// transcripts: who rang whom, and whether the ring is seen to have arrived.

/** How many notices of the record, and how many messages between sessions, a board holds and prints: the
 * last ones, like the lines of the relief file. The record has the rest. */
export const CHANNEL_LINES = 5;

/** The messages the sessions of a board sent each other, the oldest first: `{ id, at, from: { session,
 * title }, to: { address, session, title }, summary, state }`.
 *
 * A message is a `SendMessage` call of one transcript (`sent`), and it is seen to have arrived when a
 * transcript of the board holds a message from a session with the same id (`received`): `state` is then
 * `'arrived'`, and `to` has the session that got it and its title, which is not always the address it was
 * sent to (a title handed over, a session's own address). Otherwise it is `'failed'` when the call
 * failed, and `'not-seen'`: no transcript of the board holds it, which is all a transcript can show. The
 * app may hold it, it may have expired, or it reached a session whose transcript is outside the window
 * or could not be read; nothing here calls it held. A message that arrived and whose sender's transcript
 * is not on the board is given from the receiver's side, with the title the sender had.
 *
 * `summary` is the line the call gave about the message (`sentMessage`), `null` for one seen only from
 * the receiver's side. No text of a message is kept: the notice of the record is what was said, and the
 * transcript has the message. A message written twice (a session the app restarted writes its entries
 * again in a new transcript) is one: by its id, and by `copyKey` when it has none. */
function messagesBetween(sessions) {
  const readable = sessions.filter((session) => !session.unavailable);
  const whose = (session) => ({ session: session.id, title: hasTitle(session) ? session.title : null });
  const arrivals = new Map(); // message id -> { at, name, receiver }
  for (const session of readable) {
    for (const message of session.received ?? []) {
      if (message.from === 'session' && message.id !== null && !arrivals.has(message.id)) arrivals.set(message.id, { at: message.at, name: message.name, receiver: session });
    }
  }
  // A send is a call, and its copy in the transcript of a restart is the same entry again: the same time
  // to the millisecond, address, kind of address and summary, under the same title. Those are the key by
  // which two copies are one send. What its result gave is not part of it, because the result can be in
  // one transcript only (a session restarted between the call and its result): one copy then has no id
  // and the other has it, or one failed and the other says nothing yet. The copy that knows more is
  // kept: an id, then a failure, then neither.
  //
  // Copies are matched across transcripts only: two calls of one transcript are two messages whatever
  // they share, since one reply can make both, so a send of a key held so far takes at most one call of
  // each transcript. Two ids are two sends: a call with an id is the held send with that id, or else the
  // first held send of its key that has no id yet, and never one with another id (a transcript resumed
  // part way holds only some of the sends of a key, so the place of a call among them says nothing). A
  // call with no id is the first held send of its key that no call of its transcript is yet. A send
  // with no time has no key. Two different messages would have to come from two sessions of one title,
  // in the same millisecond, to one address, in the same words.
  const copyKey = (session, message) => (typeof message.at === 'string' ? JSON.stringify([whose(session).title, message.at, message.to, message.toKind ?? null, message.summary ?? null]) : null);
  const known = (message) => (message.id !== null ? 2 : message.failed ? 1 : 0);
  //
  // The sends are kept in the order of the calls: sends of one reply share their moment, so that order
  // is all that tells the last of them from the first. A send a transcript adds goes before the send
  // its next call is, so a transcript that holds only the last sends of a reply, read first, does not
  // put them before the rest.
  const calls = []; // one per send, in the order of the calls: { session, message }, the copy that knows most
  const slots = new Map(); // key -> the sends of that key held so far
  for (const session of readable) {
    const sent = session.sent ?? [];
    const sends = new Array(sent.length); // the send each call of this transcript is, by its place
    const added = new Set(); // those no transcript before this one had
    const here = new Map(); // key -> the places of the calls of this transcript that have it, in their order
    sent.forEach((message, place) => {
      const key = copyKey(session, message);
      if (key === null) {
        sends[place] = { session, message };
        added.add(sends[place]);
      } else {
        here.set(key, [...(here.get(key) ?? []), place]);
      }
    });
    for (const [key, places] of here) {
      const held = slots.get(key) ?? [];
      slots.set(key, held);
      const taken = new Set(); // the held sends a call of this transcript already is
      const rest = [];
      for (const place of places) {
        const { id } = sent[place];
        const same = id === null ? undefined : held.find((send) => send.message.id === id && !taken.has(send));
        if (same === undefined) {
          rest.push(place);
          continue;
        }
        taken.add(same);
        sends[place] = same;
      }
      for (const place of rest) {
        const message = sent[place];
        const copied = held.find((send) => !taken.has(send) && (message.id === null || send.message.id === null));
        const send = copied ?? { session, message };
        taken.add(send);
        sends[place] = send;
        if (copied === undefined) {
          held.push(send);
          added.add(send);
        } else if (known(message) > known(copied.message)) {
          Object.assign(copied, { session, message });
        }
      }
    }
    let next = calls.length; // where in `calls` the send of the following call of this transcript is
    for (let place = sent.length - 1; place >= 0; place -= 1) {
      if (added.has(sends[place])) calls.splice(next, 0, sends[place]);
      else next = calls.indexOf(sends[place]);
    }
  }
  const messages = [];
  const sent = new Set();
  for (const { session, message } of calls) {
    // An id is one message whatever else its copies say (a session renamed between two transcripts).
    if (message.id !== null) {
      if (sent.has(message.id)) continue;
      sent.add(message.id);
    }
    const arrival = message.id === null ? undefined : arrivals.get(message.id);
    const to = arrival ? whose(arrival.receiver) : { session: null, title: null };
    messages.push({ id: message.id, at: message.at, from: whose(session), to: { address: message.to, ...to }, summary: message.summary ?? null, state: arrival ? 'arrived' : message.failed ? 'failed' : 'not-seen' });
  }
  for (const [id, arrival] of arrivals) {
    if (!sent.has(id)) messages.push({ id, at: arrival.at, from: { session: null, title: arrival.name }, to: { address: null, ...whose(arrival.receiver) }, summary: null, state: 'arrived' });
  }
  const time = (message) => message.at ?? '';
  return messages.sort((one, other) => (time(one) < time(other) ? -1 : time(one) > time(other) ? 1 : 0));
}

/** The channel of a board, from the record as its reader gives it (`{ path, notices, skipped,
 * unavailable }`, bin/lib/channel.mjs) and the board's sessions: `{ path, skipped, noticeCount, notices,
 * forOrchestrator: { count, notices }, messageCount, messages }`, and `unavailable` with the reason when
 * the record is there and could not be read. `notices` are the last `count` of the record, in the order
 * written, and `messages` the last `count` between sessions (`messagesBetween`); the two counts are of
 * all of them.
 *
 * `forOrchestrator` is the same for the notices addressed to the orchestrator's role alone: how many the
 * record holds, and the last `count`. A watch compares that number between two looks, so it returns for
 * a notice written to the orchestrator and for no other (`boardChanges`); the record only grows, so the
 * number says how many are new. */
export function channelOf(record, sessions, { count = CHANNEL_LINES } = {}) {
  const notices = record.notices ?? [];
  const last = (items) => items.slice(items.length - Math.min(count, items.length));
  const toOrchestrator = notices.filter((notice) => notice.to.role === 'orchestrator');
  const messages = messagesBetween(sessions);
  return {
    path: record.path,
    ...(record.unavailable !== undefined && { unavailable: record.unavailable }),
    skipped: record.skipped ?? 0,
    noticeCount: notices.length,
    notices: last(notices),
    forOrchestrator: { count: toOrchestrator.length, notices: last(toOrchestrator) },
    messageCount: messages.length,
    messages: last(messages),
  };
}

// ---- whose words a line of a transcript holds ---------------------------------------------------------

// A paste as the host writes it into the person's entry: the same id opens and closes it. The command that changes a
// rule strips it too, to store only what he typed (bin/lib/rules-change.mjs).
export const PASTED_CONTENT = /<pasted_content id="([^"]*)">[\s\S]*?<\/pasted_content id="\1">/g;

const TOOL_RESULT = 'the result of a tool call';
const isToolResult = (block) => block.type === 'tool_result';

/** The names the hosts give the tool a session asks the person a question with. It is data: a host that names
 * its tool otherwise is one more name here and no other change. Only a tool of this list asks the person: the
 * result of any other is written by that tool, and a server's tool can give its result any shape it likes. */
export const QUESTION_TOOLS = ['AskUserQuestion'];
/** The word a numbered question's text starts with, as the person sees it. It is data, like the tools' names:
 * a project that asks in another language is one more value here and no other change. */
export const QUESTION_WORD = 'Pregunta';
/** How the text of question `number` of the channel's record starts when a session asks it with the tool:
 * `notify` prints it for the asker, and a call joins that question only when a text it asked starts with
 * exactly this. The number alone is no key: sessions numbered questions by hand before the record did. */
export const questionPrefix = (number) => `${QUESTION_WORD} ${number}: `;
/** No call to pair a result with: what an entry read by itself has. */
const NO_CALLS = new Map();

/** The calls of a question tool among `entries`, by the call's id: `{ tool, questions, sidechain, at }`, the
 * questions as the call's input has them, unread. */
function questionCallsOf(entries) {
  const calls = new Map();
  for (const entry of entries) {
    if (entry.type !== 'assistant') continue;
    for (const block of blocksOf(entry)) {
      if (block.type !== 'tool_use' || typeof block.id !== 'string' || !QUESTION_TOOLS.includes(block.name)) continue;
      calls.set(block.id, { tool: block.name, questions: block.input?.questions, sidechain: entry.isSidechain === true, at: entry.timestamp ?? null });
    }
  }
  return calls;
}

/** The question calls of a transcript's `text` that the id `id` can pair with: only the lines that name the id
 * are parsed, so one line is quoted without reading a whole transcript as entries. */
function questionCallsNaming(text, id) {
  const entries = [];
  for (const written of text.split('\n')) {
    if (!written.includes(id)) continue;
    try {
      const entry = JSON.parse(written);
      if (isObject(entry)) entries.push(entry);
    } catch {
      // A line that does not parse holds no call.
    }
  }
  return questionCallsOf(entries);
}

/** What the hosts write in the place of an answer when the person closes a question without answering it: how
 * that text begins. Claude Code writes "[User dismissed — do not proceed, wait for next instruction]", in a
 * result it does not mark an error (four lines of this project's transcripts, 2026-10-12). It is data, like the
 * tools' names: another host, or another version of this one, may say it otherwise. */
export const QUESTION_DISMISSED = ['[User dismissed'];

const SEVERAL = ', ';
/** What a result is said to be when the person closed the question: `questionsOf` tells it from the other refusals. */
const QUESTION_CLOSED = 'the result of a question the person closed without answering';

/** Whether `answer` is labels of `options` joined with the separator the host joins several with. A label may
 * hold that separator, so the answer is not split on it: it is matched whole labels at a time, whichever way
 * it divides. Each place of the answer where a label may begin is looked at once: labels that are joins of
 * each other divide an answer in more ways than could be walked, and the labels are what a session wrote. */
function isLabelsJoined(answer, options) {
  const labels = options.filter((label) => label !== '');
  const begun = new Set([0]);
  const toLook = [0];
  while (toLook.length > 0) {
    const from = toLook.pop();
    for (const label of labels) {
      if (!answer.startsWith(label, from)) continue;
      const end = from + label.length;
      if (end === answer.length) return true;
      const next = end + SEVERAL.length;
      if (answer.startsWith(SEVERAL, end) && !begun.has(next)) {
        begun.add(next);
        toLook.push(next);
      }
    }
  }
  return false;
}

/** How the person gave an answer: `tapped` when it is one of the options the question showed, or, for a question
 * that takes several, when it is options joined; `typed` otherwise, which is his own text. */
function howAnswered(answer, options, several) {
  if (options.includes(answer)) return 'tapped';
  return several && isLabelsJoined(answer, options) ? 'tapped' : 'typed';
}

/** What an entry that holds the result of a tool call is: the person's answer to a question the session asked
 * with the host's question tool, `{ what: null, at, tool, answers }`, each answer `{ question, options, answer,
 * how }` in the order the questions were asked, with the options as they were shown; or `{ what }`, in words,
 * for every other result.
 *
 * It is a guard, since what it accepts is taken as his word. The result must be the entry's only block and pair,
 * by the call's id, with a call in `calls` (`questionCallsOf`: a call of a tool of `QUESTION_TOOLS`, in the same
 * transcript); neither may be of a side chain; the entry may carry no mark of the host or of another sender;
 * the host must not have marked the result an error; `toolUseResult.answers` must hold a text for every
 * question the call asked and for no other; and none of those texts may be what the host writes for a question
 * he closed (`QUESTION_DISMISSED`), which has the shape of an answer and is none. */
function answerOf(entry, calls) {
  const blocks = blocksOf(entry);
  const call = blocks.length === 1 && isToolResult(blocks[0]) ? calls.get(blocks[0].tool_use_id) : undefined;
  if (call === undefined) return { what: TOOL_RESULT };
  if (call.sidechain || entry.isSidechain) return { what: 'an entry of a side chain' };
  if (entry.isMeta || entry.isCompactSummary || entry.origin !== undefined) return { what: TOOL_RESULT };
  const questions = Array.isArray(call.questions) ? call.questions : [];
  const asked = questions.map((question) => (isObject(question) && typeof question.question === 'string' ? question.question : ''));
  if (asked.length === 0 || asked.some((question) => question.trim() === '')) return { what: 'the result of a question whose call holds no question' };
  const given = isObject(entry.toolUseResult) && isObject(entry.toolUseResult.answers) ? entry.toolUseResult.answers : null;
  const unanswered = { what: 'the result of a question the person did not answer' };
  if (blocks[0].is_error === true || given === null) return unanswered;
  if (Object.keys(given).some((question) => !asked.includes(question))) return { what: 'the result of a question whose answers are not for what was asked' };
  if (!asked.every((question) => typeof given[question] === 'string' && given[question].trim() !== '')) return unanswered;
  // The host's own words in the place of an answer: he closed the question. One closed question closes the call.
  const closed = (answer) => QUESTION_DISMISSED.some((mark) => answer.trimStart().startsWith(mark));
  if (asked.some((question) => closed(given[question]))) return { what: QUESTION_CLOSED };
  const answers = questions.map((question) => {
    const options = (Array.isArray(question.options) ? question.options : []).map((option) => option?.label).filter((label) => typeof label === 'string');
    const answer = given[question.question];
    return { question: question.question, options, answer, how: howAnswered(answer, options, question.multiSelect === true) };
  });
  return { what: null, at: entry.timestamp ?? null, tool: call.tool, askedAt: call.at ?? null, answers };
}

/** The questions a transcript's `entries` put to the person with a question tool, one a call in the order the
 * file first has them: `{ id, at, asked, state, line }`, with the call's id and time, the texts it asked and the
 * line the call is at (`null` for an entry `parseTranscript` did not read). `state` is what became of it, by
 * `answerOf` on the call's result: `answered` (then `answeredAt` and `answeredLine`, the line of the result too),
 * `closed` (he closed it without answering), `unanswered` (a result that is no answer of his: the host marked an
 * error, or it holds none) or `pending` (no result in the file: it is on his screen, or the session stopped
 * there). A call of a side chain asks nobody and is left out; a call the host wrote again is the same question. */
export function questionsOf(entries) {
  const calls = questionCallsOf(entries);
  const found = new Map();
  for (const entry of entries) {
    if (entry.type !== 'assistant' || entry.isSidechain) continue;
    for (const block of blocksOf(entry)) {
      if (block.type !== 'tool_use' || !calls.has(block.id) || found.has(block.id)) continue;
      const questions = Array.isArray(block.input?.questions) ? block.input.questions : [];
      const asked = questions.map((question) => (isObject(question) && typeof question.question === 'string' ? question.question : '')).filter((question) => question !== '');
      found.set(block.id, { id: block.id, at: entry.timestamp ?? null, asked, state: 'pending', line: LINE_OF.get(entry) ?? null });
    }
  }
  for (const entry of entries) {
    if (entry.type !== 'user') continue;
    for (const block of blocksOf(entry)) {
      const question = isToolResult(block) ? found.get(block.tool_use_id) : undefined;
      if (question === undefined || question.state === 'answered') continue;
      const { what } = answerOf(entry, calls);
      question.state = what === null ? 'answered' : what === QUESTION_CLOSED ? 'closed' : 'unanswered';
      if (what === null) {
        question.answeredAt = entry.timestamp ?? null;
        question.answeredLine = LINE_OF.get(entry) ?? null;
      }
    }
  }
  return [...found.values()];
}

// What became of a call that several files hold: the most that any of them knows.
const QUESTION_STATE_RANK = { pending: 0, unanswered: 1, closed: 2, answered: 3 };

/** The call a question of the record is joined to: the newest of `calls` asked after its notice was written (`at`)
 * whose text starts with the prefix of `number`, or `null`. A call with no time joins nothing, since its order is
 * not known. The number alone is no key: sessions numbered questions by hand before the record did. */
function callOfNumber(calls, number, at) {
  const prefix = questionPrefix(number);
  const written = Date.parse(at ?? '');
  let joined = null;
  for (const call of calls) {
    const when = Date.parse(call.at ?? '');
    if (Number.isNaN(when) || Number.isNaN(written) || when <= written) continue;
    if (!call.asked.some((text) => text.startsWith(prefix))) continue;
    if (joined === null || when > Date.parse(joined.at)) joined = call;
  }
  return joined;
}

/** The questions put to the person that have no answer of his, over the transcripts a board read: `{ open,
 * transcripts, hours }`. `sessions` are the board's, each with the `questions` of its transcript
 * (`questionsOf`); one that could not be read has none and is not counted in `transcripts`. The host copies
 * calls from one session's file to another's, so a call is one question whatever the number of files that
 * hold it: answered in any of them is answered, and who asked is the file that has it first. A question
 * asked again later and answered then is not open either, each question of a call by itself: a call is open
 * while one of its questions has no answer. `open` is oldest first, each `{ id, at, question, more, state,
 * asker }`: the first text of the call that has no answer and how many more of it have none, `state` as `questionsOf`
 * gives it without `answered`, and the asker's `{ id, title }`. `hours` is the board's window, for whoever
 * prints the list to say what it covers: the transcripts that changed in it, each read whole, so a
 * question of days ago in a session still at work is listed too. Nothing here is remembered by a session:
 * it is all read.
 *
 * With `record` (`questionRecordOf`: the questions of the channel's record), it also gives `record` and
 * `recorded`: one item for each question of the record that no notice closed, in the order of the numbers,
 * `{ number, at, asker, question, waits, state, call }`. A call asked for it after its notice was written and
 * with its prefix is the question's call (`callOfNumber`); `state` is `not-shown` when there is none, the call's
 * own state otherwise, or `answered-not-carried` when the answer is in a transcript other than the asker's, with
 * `answered: { session, line, at }` of that answer. An answer in the asker's own transcript closed the question
 * already, so it is left out. What a call asked for a question of the record, open or closed, is left out of
 * `open`; what else it asked stays there. */
export function openQuestionsOf(sessions, { hours = null, record } = {}) {
  const read = sessions.filter((session) => Array.isArray(session.questions));
  const sooner = (one, other) => one !== null && other !== null && one < other;
  const calls = new Map();
  for (const session of read) {
    for (const question of session.questions) {
      const seen = calls.get(question.id);
      const state = seen !== undefined && QUESTION_STATE_RANK[seen.state] > QUESTION_STATE_RANK[question.state] ? seen.state : question.state;
      // Every transcript that holds the answer, in the order of the sessions, so the asker's own is found among them.
      const answeredIn = [...(seen?.answeredIn ?? []), ...(question.state === 'answered' ? [{ session: session.id, line: question.answeredLine ?? null, at: question.answeredAt ?? null }] : [])];
      if (seen === undefined || sooner(question.at, seen.at)) calls.set(question.id, { id: question.id, at: question.at, asked: question.asked, state, answeredIn, asker: { id: session.id, title: session.title ?? null } });
      else Object.assign(seen, { state, answeredIn });
    }
  }
  const all = [...calls.values()];
  // A question asked again later and answered then has his answer, one question at a time: a call that asked
  // two is open while either has none, and what it lists is what is left of it.
  const answeredLater = (call, text) => all.some((other) => other.state === 'answered' && other.asked.includes(text) && sooner(call.at, other.at));
  // What a question of the record took of its call: the texts with its prefix. A call may ask something else
  // beside it, which no notice holds: the call stays listed for that.
  const taken = new Map();
  for (const question of record ?? []) {
    const call = callOfNumber(all, question.number, question.at);
    if (call !== null) taken.set(call.id, [...(taken.get(call.id) ?? []), questionPrefix(question.number)]);
  }
  const isTaken = (call, text) => (taken.get(call.id) ?? []).some((prefix) => text.startsWith(prefix));
  const open = all
    .filter((call) => call.state !== 'answered')
    .map((call) => ({ ...call, left: call.asked.filter((text) => !answeredLater(call, text) && !isTaken(call, text)) }))
    .filter((call) => call.asked.length === 0 || call.left.length > 0)
    // Oldest first, a call with no time last. The times are compared as text, character by character: a
    // comparison by the locale's rules puts `~` before the digits, which listed a timeless call first.
    .sort((one, other) => ((one.at ?? '~') < (other.at ?? '~') ? -1 : (one.at ?? '~') > (other.at ?? '~') ? 1 : 0))
    .map(({ id, at, left, state, asker }) => ({ id, at, question: left[0] ?? '', more: Math.max(left.length - 1, 0), state, asker }));
  if (record === undefined) return { open, transcripts: read.length, hours };
  const recorded = [];
  for (const question of record.filter((item) => !item.closed).sort((one, other) => one.number - other.number)) {
    const call = callOfNumber(all, question.number, question.at);
    const answeredIn = call?.answeredIn ?? [];
    if (answeredIn.some((holder) => sameSession(holder.session, question.from.id))) continue;
    const state = call === null ? 'not-shown' : call.state === 'answered' ? 'answered-not-carried' : call.state;
    const item = { number: question.number, at: question.at, asker: { ...question.from }, question: question.text, waits: question.waits, state, call: call?.id ?? null };
    if (state === 'answered-not-carried') item.answered = { session: answeredIn[0].session, line: answeredIn[0].line, at: answeredIn[0].at };
    recorded.push(item);
  }
  return { open, transcripts: read.length, hours, record, recorded };
}

/** The questions of the channel's record that a board keeps, from what `recordedQuestions` gives (`[{ number, notice,
 * closed }]`): each one's number, when its notice was written, who asked it (`from`, each field `null` when the
 * notice names none), its text and what waits on it, and whether a notice of the record has closed it. It is plain
 * data, so a board in `--json` carries it. */
export function questionRecordOf(recorded) {
  const word = (value) => (typeof value === 'string' ? value : null);
  return recorded.map(({ number, notice, closed }) => ({
    number,
    at: notice.at,
    from: { id: word(notice.from?.id), title: word(notice.from?.title) },
    text: notice.text,
    waits: notice.waits,
    closed: closed !== null,
  }));
}

/** The questions of the channel's record with the call each one is joined to, in the order of the numbers: each item of
 * `questionRecordOf` (`record`, open or closed) with one more key, `call`. It is `null` when no call of `questions`
 * (`questionsOf`, for one transcript) is joined to the question, else `{ id, state, at, line }`, with `answeredAt` and
 * `answeredLine` as well when the call is answered. The join is `callOfNumber`: a call asked after the notice, with the
 * prefix of the number. Every state is given, the answered calls too: a session compacted after he tapped an answer
 * must know that the question is answered, or it asks him again. */
export function recordQuestionsIn(record, questions) {
  return [...record].sort((one, other) => one.number - other.number).map((item) => {
    const call = callOfNumber(questions, item.number, item.at);
    if (call === null) return { ...item, call: null };
    const joined = { id: call.id, state: call.state, at: call.at, line: call.line };
    return { ...item, call: call.state === 'answered' ? { ...joined, answeredAt: call.answeredAt, answeredLine: call.answeredLine } : joined };
  });
}

/** What an entry is when it is not what the person sent, in words: `null` for one that is. The result of a tool
 * call is never his here: `quoteEntry` asks `answerOf` first, which knows the one result that is. */
function notThePersons(entry) {
  if (entry.type === 'assistant') return 'an assistant entry';
  if (entry.type !== 'user') return `an entry of type ${JSON.stringify(entry.type ?? null)}`;
  if (blocksOf(entry).some(isToolResult)) return TOOL_RESULT;
  if (entry.isCompactSummary) return 'a compaction summary';
  if (entry.isSidechain) return 'an entry of a side chain';
  if (isPeerMessage(entry)) return peerInWords(peerMessageOf(entry));
  const kind = isObject(entry.origin) ? entry.origin.kind : undefined;
  if (kind === 'task-notification') return 'a task notification';
  if (entry.isMeta) return 'a meta entry: the host wrote it, not the person';
  // A host from before `origin` wrote none: such an entry may be his, and nothing in it says so.
  if (kind === undefined) return 'a user entry that records no origin: it cannot be told whose it is';
  return kind === 'human' ? null : `a user entry of origin ${JSON.stringify(kind)}`;
}

/** What an entry of type `attachment` is for a quote: `{ what: null, prompt, at }` for a message the
 * person sent while the session worked, and `{ what }`, in words, for any other.
 *
 * The host does not write such a message as a `user` entry: it queues it and writes an attachment of
 * type `queued_command`, with the text in `prompt`. It queues the same way a message from another
 * session and the end of a task, so the type alone says nothing of whose it is (`queuedCommandOf`, which
 * the task accounting reads too). The person's is the one whose `origin.kind` is `human` and that the
 * host marks as a turn of his (`humanTurn: true`), both inside the attachment: of 310 queued commands in
 * this project's transcripts (2026-10-11) the 28 of origin `human` carry the mark and no other does. A
 * quote asks for the mark and for text to give; a task starts without them (`instructionBy`).
 *
 * One of origin `peer` is named by who sent it, as a `user` entry of that origin is (`peerInWords`):
 * called a message from another session whatever it was, a subagent's hand-back was given a sender it
 * never had. */
function queuedMessageOf(entry) {
  if (!isObject(entry.attachment)) return { what: 'an entry of type "attachment" that holds no attachment' };
  const queued = queuedCommandOf(entry);
  if (queued === null) return { what: `an attachment of type ${JSON.stringify(entry.attachment.type ?? null)}: the host wrote it, not the person` };
  const { attachment, kind } = queued;
  if (kind === 'task-notification') return { what: 'a queued task notification' };
  if (kind === undefined) return { what: 'a queued message that records no origin: it cannot be told whose it is' };
  if (kind === 'peer') return { what: peerInWords(peerMessageOf(entry), { queued: true }) };
  if (kind !== 'human') return { what: `a queued message of origin ${JSON.stringify(kind)}` };
  if (attachment.humanTurn !== true) return { what: 'a queued message of origin "human" that the host does not mark as a turn of the person' };
  if (typeof attachment.prompt !== 'string') return { what: 'a queued message of the person that holds no text to quote' };
  return { what: null, prompt: attachment.prompt, at: attachment.timestamp };
}

/** The entry at line `line` (from 1) of a transcript's `text`, when it is what the person sent: `{
 * person: true, at, text, images, pastedOnly, queued }`, with the time of the entry, its text as the
 * transcript has it (the text blocks of a list, one per line), how many images came with it, whether it
 * is only pasted content: one or more pastes as the host wraps them (`PASTED_CONTENT`) and nothing typed
 * before, between or after them; and whether he sent it while the session worked (`queued`), which the
 * host writes as an attachment and not as a `user` entry (`queuedMessageOf`). Anything else is `{ person:
 * false, what }`, `what` saying which entry it is, or that there is none at that line.
 *
 * It is what `sessions --quote` answers with, and what a session checks before it takes words carried
 * by another session as the user's: a user entry whose `origin.kind` is `human`, or a queued message of
 * that origin marked as his turn, and no other. The host marks a message from another session `peer`,
 * a task's end `task-notification`, and writes no origin on what it puts in itself.
 *
 * One more entry is his: the answer he gave to a question the session asked with the host's question tool
 * (`answerOf`, which says what makes it one). It comes back with `answered: { tool, askedAt, answers }`,
 * `askedAt` being when the call was asked (`null` when its entry holds no time), each answer
 * with its question, the options shown and whether he tapped one or typed his own; `text` is the answers,
 * one a line. */
export function quoteOf(text, line) {
  const found = entryAt(text, line);
  if (found.what !== undefined) return { person: false, what: found.what };
  const id = blocksOf(found.entry).find(isToolResult)?.tool_use_id;
  return quoteEntry(found.entry, typeof id === 'string' && id !== '' ? questionCallsNaming(text, id) : NO_CALLS);
}

/** The entry at line `line` (from 1) of a transcript's `text`, as `{ entry }`, or `{ what }` in words when there
 * is none to read there: no such line, an empty line, a line that does not parse or is not an object. `quoteOf`
 * and `replyOf` both read a line this way, so a line means the same to each. */
function entryAt(text, line) {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop(); // what follows the last line break is not a line
  // A whole number only: 1.5 is inside the range and names no line.
  if (!(Number.isSafeInteger(line) && line >= 1 && line <= lines.length)) return { what: `no line of the transcript, which has ${lines.length} line${lines.length === 1 ? '' : 's'}` };
  const written = lines[line - 1];
  if (written.trim() === '') return { what: 'an empty line' };
  let entry;
  try {
    entry = JSON.parse(written);
  } catch {
    entry = null;
  }
  if (!isObject(entry)) return { what: 'not an entry: the line does not parse' };
  return { entry };
}

/** What `quoteOf` gives for one parsed entry: the person's words, or `{ person: false, what }`. The stretch before
 * a compaction asks the same question of each entry (`compactionStretch`), so whose words an entry is has one rule. */
function quoteEntry(entry, calls = NO_CALLS) {
  if (entry.type === 'user' && blocksOf(entry).some(isToolResult)) {
    const answer = answerOf(entry, calls);
    if (answer.what !== null) return { person: false, what: answer.what };
    const said = answer.answers.map(({ answer: given }) => given).join('\n');
    return { person: true, at: answer.at, text: said, images: 0, pastedOnly: false, queued: false, answered: { tool: answer.tool, askedAt: answer.askedAt, answers: answer.answers } };
  }
  const queued = entry.type === 'attachment' ? queuedMessageOf(entry) : null;
  const what = queued ? queued.what : notThePersons(entry);
  if (what !== null) return { person: false, what };
  const content = queued ? queued.prompt : entry.message?.content;
  const blocks = queued ? [] : blocksOf(entry);
  const said = typeof content === 'string' ? content : blocks.filter(isText).map((block) => block.text).join('\n');
  const typed = said.replace(PASTED_CONTENT, '');
  return { person: true, at: entry.timestamp ?? queued?.at ?? null, text: said, images: blocks.filter((block) => block.type === 'image').length, pastedOnly: typed !== said && typed.trim() === '', queued: queued !== null };
}

/** What an entry is when it is not a reply of the session, in words, or `null` for the session's own reply. The
 * person's entries say so; anything else says what it is, in the words `notThePersons` and `queuedMessageOf` use. */
function notTheSessions(entry) {
  if (entry.isSidechain) return entry.type === 'assistant' ? 'a reply of a side chain' : 'an entry of a side chain';
  if (entry.type === 'assistant') return isOwnReply(entry) ? null : 'a reply the harness wrote itself, not the session';
  const what = entry.type === 'attachment' ? queuedMessageOf(entry).what : notThePersons(entry);
  return what ?? "the person's entry";
}

/** The session's own reply at line `line` (from 1) of a transcript's `text`, read as `quoteOf` reads the person's
 * words: `{ reply: true, at, text }`, its text blocks joined by a blank line, or `{ reply: false, what }` in words.
 * A reply that holds no text block (only tool calls, or thinking) has no words to give, and says so. */
export function replyOf(text, line) {
  const found = entryAt(text, line);
  if (found.what !== undefined) return { reply: false, what: found.what };
  const what = notTheSessions(found.entry);
  if (what !== null) return { reply: false, what };
  const said = blocksOf(found.entry).filter(isText);
  if (said.length === 0) return { reply: false, what: 'a reply with no text block: only tool calls and thinking' };
  return { reply: true, at: found.entry.timestamp ?? null, text: said.map((block) => block.text).join('\n\n') };
}

// ---- the stretch before a compaction ------------------------------------------------------------------------
//
// A session the host compacted is told what its transcript still holds of the work before the compaction:
// where the person wrote, where other sessions wrote, where the session last answered and which files it
// wrote. That is read here from the text alone: no file system, and no line of the transcript is taken twice.

/** An entry's time as the transcript holds it, a string, or `null` for anything else. */
const timeOf = (value) => (typeof value === 'string' ? value : null);

/** The entries of `text` as the stretch reads them, `{ line, entry, at, uuid }`, in file order. The host copies
 * entries: a boundary, and sometimes over a thousand old entries with an older boundary at their head, are
 * written again later in the same file with the same `uuid` and `timestamp`, so file order is not time order.
 * An entry is counted once, at the line of its first appearance: a line whose `uuid` was seen before is skipped,
 * and an entry with no `uuid` is always counted. An entry's time is its own `timestamp`, else its attachment's,
 * else the time of the counted entry before it, `null` when there is none. A line that does not parse, or is not
 * an object, is skipped as `parseTranscript` skips it. */
function firstAppearances(text) {
  const seen = new Set();
  const counted = [];
  let previous = null;
  for (const [index, written] of text.split('\n').entries()) {
    if (written.trim() === '') continue;
    let entry;
    try {
      entry = JSON.parse(written);
    } catch {
      continue;
    }
    if (!isObject(entry)) continue;
    const uuid = typeof entry.uuid === 'string' ? entry.uuid : null;
    if (uuid !== null) {
      if (seen.has(uuid)) continue;
      seen.add(uuid);
    }
    const at = timeOf(entry.timestamp) ?? timeOf(entry.attachment?.timestamp) ?? previous;
    counted.push({ line: index + 1, entry, at, uuid });
    previous = at;
  }
  return counted;
}

/** Oldest first by `at`, a null time first. Entries of one time keep their order in the file, as the sort is stable. */
function oldestFirst(one, other) {
  const [a, b] = [one.at ?? '', other.at ?? ''];
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Whether an entry at `at` lies inside `stretch`: after its `after` and before its `before`, a bound that is `null`
 * being open. An entry with no time lies in no stretch that has a bound. */
function within(at, { after, before }) {
  return (after === null || (at !== null && at > after)) && (before === null || (at !== null && at < before));
}

/** Whether `text` holds a compact block: a fenced code block whose whole content, trimmed, is `/compact`. */
export function holdsCompactBlock(text) {
  const lines = text.split('\n').map((line) => line.trim());
  for (let open = 0; open < lines.length; open += 1) {
    if (!/^```[\w+#.-]*$/.test(lines[open])) continue;
    // The block ends at the next bare fence; a fence that closes a block is never an opening one.
    const close = lines.indexOf('```', open + 1);
    if (close === -1) return false;
    const content = lines.slice(open + 1, close).filter((line) => line !== '');
    if (content.length === 1 && content[0] === '/compact') return true;
    open = close;
  }
  return false;
}

/** The compactions of `counted` once each, oldest first, as `{ uuid, at, automatic, before, line }`. */
function boundariesOf(counted) {
  return counted
    .filter(({ entry }) => !entry.isSidechain)
    .flatMap(({ line, entry, at, uuid }) => {
      const compaction = compactionOf(entry);
      return compaction === null ? [] : [{ uuid, at, automatic: compaction.automatic, before: compaction.before, line }];
    })
    .sort(oldestFirst);
}

/** The Edit and Write calls the session made in `counted`, oldest first, as `{ line, at, path }`. */
function writesOf(counted) {
  return counted
    .filter(({ entry }) => isOwnReply(entry))
    .flatMap(({ line, entry, at }) =>
      blocksOf(entry)
        .filter((block) => block.type === 'tool_use' && (block.name === 'Edit' || block.name === 'Write') && typeof block.input?.file_path === 'string' && block.input.file_path !== '')
        .map((block) => ({ line, at, path: block.input.file_path })),
    )
    .sort(oldestFirst);
}

/** A feature document: `odd/tasks/<name>.md`, under any folder, with either slash. */
const FEATURE_DOCUMENT = /(?:^|[\\/])odd[\\/]tasks[\\/][^\\/]+\.md$/;

/** The path of the last feature document that `wrote` holds written before `at`, or `null`. */
function documentBefore(wrote, at) {
  const found = wrote.filter((write) => write.at !== null && at !== null && write.at < at && FEATURE_DOCUMENT.test(write.path));
  return found.at(-1)?.path ?? null;
}

/** What a transcript holds of the stretch of work before its newest compaction, `{ boundaries, current, stretch,
 * person, sessions, lastReply, wrote }`:
 * - `boundaries`: every compaction of the file once, oldest first, as `{ uuid, at, automatic, before, line }`;
 * - `current`: the compaction the session has just come back from, one of `boundaries`, or `null` when the session
 *   has replied since the newest one (the compaction that just happened is not written yet) or there is none;
 * - `stretch`: `{ after, before, inThisFile }`, the times the stretch lies between (`null` where it is open), and
 *   whether the stretch holds a reply of the session, which a file the host continued does not;
 * - `person`: `{ line, at }` of each entry of the stretch that `quoteOf` gives as the person's words;
 * - `sessions`: `{ line, at, name }` of each message of another session in the stretch, not a hand-back or the host's;
 * - `lastReply`: `{ line, at }` of the session's last reply in the stretch that holds a text block, or `null`;
 * - `wrote`: `{ line, at, path }` of every Edit or Write call the session made in the whole file, oldest first.
 * A side chain never counts. */
export function compactionStretch(text) {
  const counted = firstAppearances(text);
  const boundaries = boundariesOf(counted);
  const last = boundaries.at(-1);
  let current = null;
  let stretch = { after: null, before: null };
  if (last !== undefined) {
    const replied = counted.some(({ entry, at }) => isOwnReply(entry) && at !== null && last.at !== null && at > last.at);
    if (replied) {
      stretch = { after: last.at, before: null };
    } else {
      current = last;
      stretch = { after: boundaries.at(-2)?.at ?? null, before: last.at };
    }
  }
  const inStretch = counted.filter(({ entry, at }) => !entry.isSidechain && within(at, stretch));
  // His answer to a question is his word too, and pairs with its call wherever the call is in the file.
  const calls = questionCallsOf(counted.map(({ entry }) => entry));
  const replies = inStretch.filter(({ entry }) => isOwnReply(entry) && blocksOf(entry).some(isText)).sort(oldestFirst);
  const lastReply = replies.at(-1);
  return {
    boundaries,
    current,
    stretch: { ...stretch, inThisFile: inStretch.some(({ entry }) => isOwnReply(entry)) },
    person: inStretch.filter(({ entry }) => quoteEntry(entry, calls).person).map(({ line, at }) => ({ line, at })),
    sessions: inStretch.flatMap(({ line, entry, at }) => {
      const message = peerMessageOf(entry);
      return message?.from === 'session' ? [{ line, at, name: message.name }] : [];
    }),
    lastReply: lastReply === undefined ? null : { line: lastReply.line, at: lastReply.at },
    wrote: writesOf(counted),
  };
}

const NOT_TOLD = { known: false, at: null };
const NOT_KEPT = { known: false, kept: null };

/** What the reader of the pause's state answered for the stretch from `after` to `at`, `{ known, at }`. A reader that
 * throws, or answers without `known`, knows nothing: its fact is not judged, and nothing is thrown. */
function toldOf(reader, after, at) {
  let answer;
  try {
    answer = reader(after, at);
  } catch {
    return NOT_TOLD;
  }
  const known = isObject(answer) && answer.known === true;
  return { known, at: known && typeof answer.at === 'string' ? answer.at : null };
}

/** What the reader of the feature document's state answered, `{ known, kept }`, read as `toldOf` reads the pause's. */
function keptOf(reader, query) {
  let answer;
  try {
    answer = reader(query);
  } catch {
    return NOT_KEPT;
  }
  const known = isObject(answer) && answer.known === true;
  return { known, kept: known && typeof answer.kept === 'boolean' ? answer.kept : null };
}

/** The first reply of the session in the stretch from `after` to `before` that is at or after `toldAt`, the time the
 * pause was told, and holds the compact block, as `{ line, at }`, or `null` when no reply does. */
function announcedOf(counted, { after, before, toldAt }) {
  const found = counted
    .filter(({ entry, at }) => isOwnReply(entry) && at !== null && at >= toldAt && within(at, { after, before }))
    .filter(({ entry }) => blocksOf(entry).some((block) => isText(block) && holdsCompactBlock(block.text)))
    .sort(oldestFirst);
  return found.length === 0 ? null : { line: found[0].line, at: found[0].at };
}

/** Each compaction of `text` once, oldest first, with what the transcript holds of the stretch before it:
 * `{ uuid, at, automatic, before, line, after, inThisFile, told, document, kept, announced, verdict }`. The readers
 * are asked only for a compaction the host made that the file holds a reply of the session for, at most once each.
 * With `lastAutomaticOnly`, only the newest automatic compaction is judged: the readers are asked for it alone, and
 * every other compaction has no verdict. `kept` is asked with the stretch's `document` only when the stretch has one,
 * unless `keptWithoutDocument`: the orchestrator's state is also its relief file, which needs no document, so its
 * `kept` is asked for every stretch the notice reached (with `document` `null` when there is none). */
export function compactionMeasures(text, { told = () => NOT_TOLD, kept = () => NOT_KEPT, lastAutomaticOnly = false, keptWithoutDocument = false } = {}) {
  const counted = firstAppearances(text);
  const boundaries = boundariesOf(counted);
  const wrote = writesOf(counted);
  const judged = lastAutomaticOnly ? boundaries.filter((boundary) => boundary.automatic).at(-1) : undefined;
  return boundaries.map((boundary, index) => {
    const { uuid, at, automatic, before, line } = boundary;
    const after = boundaries[index - 1]?.at ?? null;
    const stretch = { after, before: at };
    const inThisFile = counted.some(({ entry, at: when }) => isOwnReply(entry) && within(when, stretch));
    const document = documentBefore(wrote, at);
    const item = { uuid, at, automatic, before, line, after, inThisFile, told: NOT_TOLD, document, kept: NOT_KEPT, announced: null, verdict: null };
    if (!automatic || !inThisFile || (lastAutomaticOnly && boundary !== judged)) return item;
    const toldState = toldOf(told, after, at);
    const keptState = toldState.at === null || (document === null && !keptWithoutDocument) ? NOT_KEPT : keptOf(kept, { document, after: toldState.at, before: at });
    const announced = toldState.at === null ? null : announcedOf(counted, { after, before: at, toldAt: toldState.at });
    const verdicts = {
      told: toldState.known ? toldState.at !== null : null,
      kept: keptState.kept,
      announced: toldState.at === null ? null : announced !== null,
    };
    return {
      ...item,
      told: toldState,
      kept: keptState,
      announced,
      verdict: { ...verdicts, missing: ['told', 'kept', 'announced'].filter((name) => verdicts[name] === false) },
    };
  });
}

/** The miss of the session's last automatic compaction, as the board says it, or `null`: the session has no automatic
 * compaction judged in `text`, or the judged one misses no fact. `{ at, uuid, missed, unknown }`: `missed` the facts
 * that are false, `unknown` the facts a reader could not answer (never a miss). The readers are asked only for that
 * compaction, and not at all when the text names no automatic one. */
export function compactionMissOf(text, readers) {
  if (!text.includes('compact_boundary') || !text.includes('"auto"')) return null;
  const measures = compactionMeasures(text, { ...readers, lastAutomaticOnly: true });
  const judged = measures.filter((measure) => measure.automatic).at(-1);
  if (!judged?.verdict || judged.verdict.missing.length === 0) return null;
  const { verdict } = judged;
  const unknown = ['told', 'kept', 'announced'].filter((name) => verdict[name] === null);
  return { at: judged.at, uuid: judged.uuid, missed: verdict.missing, unknown };
}

// ---- what changed between two boards ------------------------------------------------------------------
//
// `sessions --watch` looks at the board again and again and returns only when something on it calls for
// a decision. What that is, is decided here, from two boards and nothing else.

/** Whether `id` is the session named by `self`: its whole id, or its first eight characters or more. */
export function isSelf(id, self) {
  return typeof self === 'string' && self !== '' && (id === self || (self.length >= 8 && id.startsWith(self)));
}

/** Whether two ids as they were written name one session: the same id, or one of them the start (eight
 * characters or more) of the other. Either side may be the short one: `--self` takes the start of an id,
 * and what was written with it keeps that start when no transcript could be read to complete it. */
export function sameSession(one, other) {
  return typeof one === 'string' && typeof other === 'string' && (isSelf(one, other) || isSelf(other, one));
}

/** Whether `transcript` names a file: a path does, and anything else is a session id or the start of one. */
export const namesAFile = (transcript) => /[\\/]/.test(transcript) || transcript.endsWith('.jsonl');

/** The transcript that `transcript` names among those of the sessions folder `projectDir`: `{ file }`, or
 * `{ not }` with why there is none to give. `transcript` is a file (`namesAFile`, resolved from `cwd`) or a
 * session id, whole or its first eight characters or more.
 *
 * Only a transcript directly in the project's sessions folder is one, as the board reads them. This is
 * the check behind every word taken as the person's: a session can write a file anywhere with a line marked
 * as a person's, and a subagent's transcript, in a folder of this one, holds what its parent session wrote
 * to it. What it does not stop: a file written into the folder itself, which is the host's to keep.
 *
 * `not` is `outside` (with the `file`: it is elsewhere, or no `.jsonl`), `short` (an id of under eight
 * characters), `unlisted` (with the `code`: the folder could not be listed, `ENOENT` when it is not there),
 * `none` (no transcript starts with the id) or `several` (with the `count`). Whether the file can be read
 * is the caller's to find out. */
export function transcriptNamed(projectDir, transcript, { cwd, readdir }) {
  if (namesAFile(transcript)) {
    const file = path.resolve(cwd, transcript);
    const inside = path.relative(projectDir, file);
    return inside === '' || /[\\/]/.test(inside) || path.isAbsolute(inside) || !inside.endsWith('.jsonl') ? { not: 'outside', file } : { file };
  }
  if (transcript.length < 8) return { not: 'short' };
  let names;
  try {
    names = readdir(projectDir);
  } catch (err) {
    return { not: 'unlisted', code: err.code ?? err.message };
  }
  const ids = names.filter((name) => name.endsWith('.jsonl')).map((name) => name.slice(0, -'.jsonl'.length)).filter((id) => isSelf(id, transcript));
  if (ids.length === 0) return { not: 'none' };
  return ids.length > 1 ? { not: 'several', count: ids.length } : { file: path.join(projectDir, `${ids[0]}.jsonl`) };
}

/** How a board says context sizes: `of(tokens)` is `342k tokens (68%)`, and `pause` is the board's pause
 * as its share of the window with its tokens after it, `<share>% of the window (<tokens>k)`: the share
 * of `DEFAULT_CONTEXT_PAUSE_PERCENT` unless the board was given another. The percentage is the share of
 * the board's context window, the number the desktop app shows; the pause leads with it because that is
 * how the rule is said and how it is set. */
function contextSizes(board) {
  const window = board.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  const pause = board.contextPause ?? shareOf(window, DEFAULT_CONTEXT_PAUSE_PERCENT);
  return { of: (tokens) => `${thousands(tokens)} tokens (${percentOf(tokens, window)}%)`, pause: `${percentOf(pause, window)}% of the window (${thousands(pause)})` };
}

/** What a board says of a session's context, piece by piece, for a session whose context was read: what
 * it holds; the room left before the host compacts it, with the point and whether the session measured
 * it; and what its last task cost, with whether a task of that cost still fits in the room. The judgment
 * the pause asks for needs the three. A piece the session does not carry (a board from before it was
 * kept) is left out. The row of the board and the line of a watch are made of the same pieces. */
function contextPieces(session, sizes) {
  const pieces = [`context ${sizes.of(session.context.tokens)}`];
  const point = session.contextCompaction;
  if (point && Number.isFinite(session.contextRoom)) {
    const where = `(${thousands(point.tokens)}${point.measured ? ', measured in this session' : ''})`;
    const room = session.contextRoom;
    if (room > 0) pieces.push(`room ${someThousands(room)} before the host compacts ${where}`);
    else pieces.push(`no room: ${room === 0 ? 'at the point' : `${someThousands(-room)} past`} where the host compacts ${where}`);
  }
  const task = session.lastTask;
  if (task?.unavailable) pieces.push(`last task not known: ${task.unavailable}`);
  else if (task) pieces.push(`last task ${thousands(task.tokens)}${session.lastTaskFits === false ? ', which no longer fits' : ''}`);
  return pieces;
}

const sessionLabel = (session) => `session ${session.id.slice(0, 8)} ${JSON.stringify(session.title ?? '(no title)')}`;
const pieces = (count) => `${count} piece${count === 1 ? '' : 's'} of work`;
const byKey = (items, key) => new Map(items.map((item) => [item[key], item]));

/** Whether `now`, a session's last compaction, is one the earlier look did not have (`lastCompaction` of
 * `sessionFacts`): another `uuid`, or, where either has none, another time. `null` is no compaction. */
function isNewCompaction(was, now) {
  if (was === null) return true;
  return was.uuid !== null && now.uuid !== null ? was.uuid !== now.uuid : was.at !== now.at;
}

/** Whether `now`, a session's miss of its last automatic compaction (`compactionMissOf`), is one the earlier look did not
 * have: none before, or another compaction than the one it named. */
function isNewMiss(was, now) {
  if (was === null) return true;
  return (was.uuid ?? was.at) !== (now.uuid ?? now.at);
}

/** How long the call a session waits on has had no result, in ms, when the board may say so, else `null`: the
 * session works and has not ended (`ended`), and its last call (`pendingCall`) is not a question, whose calls are
 * in "Open questions". A call of the agent tool is measured from the later of its launch and the last write of
 * its subagent's file, since a subagent that writes is at work. */
function pendingAge(session, now, ended) {
  const pending = session.pendingCall;
  if (!pending || ended || session.state !== 'working' || QUESTION_TOOLS.includes(pending.tool)) return null;
  const launched = Date.parse(pending.at ?? '');
  if (Number.isNaN(launched)) return null;
  const work = isAgent(pending.tool) ? session.work.find((item) => item.tool === 'Agent' && !item.ended && item.toolUseId === pending.id) : undefined;
  const written = Date.parse(work?.file?.modifiedAt ?? '');
  return now - (Number.isNaN(written) ? launched : Math.max(launched, written));
}

/** How many times the limit fits in an age of `pendingAge`, as a power of two: -1 below the limit or when no call
 * counts, 0 from the limit to twice it, 1 from twice to four times it, and so on. A watch says a call each time it grows. */
const crossingOf = (age) => (age === null || age < PENDING_CALL_LIMIT_MS ? -1 : Math.floor(Math.log2(age / PENDING_CALL_LIMIT_MS)));

/** `a` or `an`, before the name of a tool. */
const article = (tool) => (/^[aeiou]/i.test(tool) ? 'an' : 'a');

/** What a watch says of a compaction the session gained: who asked for it, how long ago it was (`ago`, as the
 * board says the age of an entry, from the time the board was read) and what the session held before it when
 * the transcript says. */
function compactionLine(session, sizes, readAt) {
  const compaction = session.lastCompaction;
  const who = compaction.automatic ? 'by the host' : "at the user's request";
  const held = Number.isFinite(compaction.before) ? `: it held ${sizes.of(compaction.before)} before it` : '';
  return `${sessionLabel(session)} was compacted ${who} ${ago(compaction.at, readAt)}${held}`;
}

function sessionChanges(before, after, self) {
  const lines = [];
  const earlier = byKey(before.sessions, 'id');
  const sizes = contextSizes(after);
  // A look that could not read the record has a roster that knows of no session that ended. The last
  // record read is then what says it (`watchBaseline` keeps its roster): a session that said `closed`
  // has not taken it back because a file was busy. Should it have opened again meanwhile, its notice
  // wakes the watch at the first look that reads the record.
  const ended = endedSessions(after.channel?.unavailable !== undefined ? before : after);
  for (const session of after.sessions) {
    const listed = earlier.get(session.id);
    // A transcript that cannot be read says nothing about what the session did.
    if (isSelf(session.id, self) || session.unavailable) continue;
    // The board to compare with keeps the last readable facts of a session (`watchBaseline`), so one that
    // is unreadable there was never read: this is the first look that says anything about it.
    const was = listed?.unavailable ? undefined : listed;
    // A session that said `closed` or `relieved` waits for nobody: its turn ending is no call to answer it.
    if (session.state === 'waiting' && ended.has(session.id)) {
      // nothing to say of its waiting, whether it appears, starts to wait or ends another turn
    } else if (!was) lines.push(`${sessionLabel(session)} appeared (${session.state})${listed ? ': its transcript could not be read until now' : ''}`);
    else if (session.state === 'waiting' && was.state !== 'waiting') {
      const open = was.work.filter((work) => !work.ended).length;
      const how = was.state === 'background' ? `: the ${pieces(open)} it had open ended` : '';
      lines.push(`${sessionLabel(session)} is waiting${how} (was ${was.state})${session.stopped ? `: stopped: ${stopWords(session.stopped)}` : ''}`);
    } else if (session.state === 'waiting' && session.turnEndedAt !== was.turnEndedAt) {
      // Waiting at both looks, but not at the same point: it was given something and finished it.
      lines.push(`${sessionLabel(session)} finished another turn and is waiting${session.stopped ? `: stopped: ${stopWords(session.stopped)}` : ''}`);
    } else if (session.state === 'background' && session.stopped && session.stopped.at !== was.stopped?.at) {
      // Stopped while work it launched runs on: no line above says it, so it is said once, here.
      lines.push(`${sessionLabel(session)} stopped: ${stopWords(session.stopped)} (its open work runs on)`);
    }
    // Once, when the host or the person compacted it since the last look. A board from before the field was
    // kept has none to compare with (`undefined`), so nothing is said of the compactions it already had.
    if (was && was.lastCompaction !== undefined && session.lastCompaction && isNewCompaction(was.lastCompaction, session.lastCompaction)) {
      lines.push(compactionLine(session, sizes, Date.parse(after.generatedAt)));
    }
    // Once, when the last automatic compaction of the session misses a fact (`compactionMissOf`); the same compaction is
    // not said twice, and a board kept before the field has no miss to compare with (`null`).
    if (was && session.compactionMiss && session.compactionMiss.missed.length > 0 && isNewMiss(was.compactionMiss ?? null, session.compactionMiss)) {
      lines.push(`${sessionLabel(session)}: its last automatic compaction missed ${session.compactionMiss.missed.join(', ')}`);
    }
    // Once, when it reaches the pause: what it does there is its own judgment, and the line carries what
    // that judgment needs. A last task that no longer fits is said in it and wakes nobody by itself.
    if (session.atContextPause === true && was?.atContextPause !== true) {
      lines.push(`${sessionLabel(session)} reached the context pause, ${sizes.pause}: ${contextPieces(session, sizes).join(', ')}`);
    }
    // Once when the call it waits on crosses the limit, and again each time its age doubles (`crossingOf`). A session
    // that the earlier look could not read had no call to compare with, so it is not compared.
    if (listed?.unavailable === undefined) {
      const age = pendingAge(session, Date.parse(after.generatedAt), ended.has(session.id));
      const sameCall = Boolean(listed?.pendingCall) && listed.pendingCall.id === session.pendingCall?.id && listed.pendingCall.tool === session.pendingCall?.tool && listed.pendingCall.at === session.pendingCall?.at;
      // The age the earlier look had is measured when its facts were read: a session it kept from an older board (`lastReadSessions`) is older than that board.
      const beforeN = sameCall ? crossingOf(pendingAge(listed, Date.parse(listed.readAt ?? before.generatedAt), ended.has(session.id))) : -1;
      if (crossingOf(age) > beforeN) {
        lines.push(`${sessionLabel(session)} has ${article(session.pendingCall.tool)} ${session.pendingCall.tool} call with no result for ${durationOf(Math.round(age / 1000))}: the host may be holding it for approval, or it hangs`);
      }
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

/** The one thing a watch says of the gates: a gate that started beside another that runs. A gate started
 * when it is no gate of the older board (`sameGate`): the worktrees say which gates are watched, never
 * whether one runs, so a worktree added under a running gate is not its start.
 *
 * Nothing is said of a gate that starts alone, of one that starts and waits for the machine's gate lock
 * (one gate running and one in line is the lock doing its work), of one that takes the lock it waited
 * for, or of one that ends. Each was said until 2026-10-11, and each woke the orchestrator for a session
 * that was only getting on with its work; the board shows them to whoever looks.
 *
 * Two gates that run at once are said, and they can only be so when one of them does not know the
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
  const is = watchedGates(after);
  if (watchedGates(before) === null || is === null) return []; // a look that listed no gates knows of none that started
  const holder = boardGates(after).find((gate) => gate.lock?.role === 'holder');
  // The gate that holds the lock and still beats runs, whatever folder it checks: the lock is the
  // machine's. A lock of which nothing could be read, not even a pid, has shown no gate.
  const holding = holder && !holder.lock.stale && !(holder.pid === null && holder.lock.beatAt === null) ? [holder] : [];
  const without = is.filter((gate) => !knowsLock(gate));
  const lines = [];
  for (const gate of is) {
    if (before.gates.items.some((old) => sameGate(old, gate)) || gate.lock?.role === 'waiter') continue;
    // Two gates at once is what the board exists to catch: they share the machine and one of them is
    // probably a mistake. A pid is one process, so a gate is never beside what carries its own.
    const other = (knowsLock(gate) ? without : [...holding, ...without]).find((item) => item.pid !== gate.pid);
    if (other) lines.push(`gate started ${gatePlace(gate)} while another runs ${gatePlace(other)}`);
  }
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

/** Who wrote a notice, in words: its title, the start of its session id, or that the host named none. */
function senderWords(from, { quoted = false } = {}) {
  if (typeof from?.title === 'string') return quoted ? JSON.stringify(from.title) : from.title;
  return typeof from?.id === 'string' ? `session ${from.id.slice(0, 8)}` : 'a sender the host does not name';
}

/** The share of its context a notice's sender held, as the channel says it after the sender's name: ` (<percent>%
 * of its context)`, or nothing when the notice carries none. */
function shareWords(from) {
  return Number.isFinite(from?.context?.percent) ? ` (${from.context.percent}% of its context)` : '';
}

/** The notices for the orchestrator that the record gained between two boards, one line each: the kind,
 * who wrote it and its text. The record only grows, so those are its last ones, as many as the count
 * rose by (`channelOf`); when it rose by more than a board holds, the rest are said by their number,
 * with the record's path. A notice the watching session wrote itself is left out: it knows it. A board
 * with no channel, or whose record could not be read, is not compared, and neither is a record that
 * shrank (an uninstall removes it). */
function channelChanges(before, after, self) {
  const was = before.channel;
  const is = after.channel;
  if (!was || !is || was.unavailable !== undefined || is.unavailable !== undefined) return [];
  const gained = is.forOrchestrator.count - was.forOrchestrator.count;
  if (gained <= 0) return [];
  const held = is.forOrchestrator.notices;
  const fresh = held.slice(held.length - Math.min(gained, held.length));
  const lines = fresh
    .filter((notice) => !sameSession(notice.from?.id, self))
    .map((notice) => `notice for the orchestrator, ${notice.kind} from ${senderWords(notice.from, { quoted: true })}: ${clipped(notice.text)}`);
  const rest = gained - fresh.length;
  if (rest > 0) lines.push(`${rest} earlier notice${rest === 1 ? '' : 's'} for the orchestrator ${rest === 1 ? 'is' : 'are'} in the record: ${is.path}`);
  return lines;
}

/** The sessions of the board `newer`, each one it could not read as the board `older` last read it, when it
 * did: what is known of a session across a look that failed on its transcript. A session kept so has `readAt`,
 * the time its facts were read: the `generatedAt` of the board that read them, or the one it was kept from. */
function lastReadSessions(older, newer) {
  const read = byKey(older.sessions.filter((session) => !session.unavailable), 'id');
  return newer.sessions.map((session) => {
    if (!session.unavailable) return session;
    const kept = read.get(session.id);
    return kept ? { ...kept, readAt: kept.readAt ?? older.generatedAt } : session;
  });
}

/** `sessions` with the miss of the look before kept where they read none: a reader that fails leaves the miss of a
 * compaction unknown (`null`), and a miss the look before named keeps its identity until a newer miss replaces it,
 * so the same compaction is not said again once the reader answers. */
function keptMisses(older, sessions) {
  const earlier = byKey(older.sessions.filter((session) => !session.unavailable), 'id');
  return sessions.map((session) => {
    const was = earlier.get(session.id)?.compactionMiss ?? null;
    return (session.compactionMiss ?? null) === null && was !== null ? { ...session, compactionMiss: was } : session;
  });
}

/** The questions the person closed without answering between two boards, one line each: who asked and
 * the text. A closed question is the one change of the list that calls for a decision, since it has to be
 * put to him again; one that is on his screen waits for him, and one he answers leaves the list. A
 * question already closed at the board before is not said again, and a board with no such list (an older
 * one) is not compared. A look that could not read a transcript lists none of its questions: the board to
 * compare with keeps them (`watchBaseline`), so they are not news at the look after. Nor does such a look
 * see an answer that transcript holds, to a question another one closed: the list of `after` is made again
 * with the facts `before` last read of each session `after` could not read, or the closed question would
 * be said as closed anew with nothing changed.
 *
 * A recorded question (`recorded`) says two more things, each once, when its state is new since the board before
 * and it is one that needs him: answered and not carried to its asker, or closed by him without an answer. One
 * still on his screen, or not shown yet, says nothing: the channel's own notice says that it was recorded. */
function questionChanges(before, after) {
  if (!before.questions || !after.questions) return [];
  const closed = (question) => question.state === 'closed';
  const known = new Set(before.questions.open.filter(closed).map((question) => question.id));
  const sessions = lastReadSessions(before, after);
  const filled = sessions.some((session, i) => session !== after.sessions[i]);
  // A look that could not read the channel's record has the list of the transcripts alone. The calls are then
  // read with the record of the look before, so that a recorded question's call is not taken for one nobody
  // recorded; and nothing is said of the recorded questions, whose notices this look did not see: the baseline
  // keeps them as they were (`watchBaseline`), and the look that reads the record again says what changed.
  const unread = after.questions.record === undefined && before.questions.record !== undefined;
  const view = filled || unread ? openQuestionsOf(sessions, { hours: after.questions.hours, record: after.questions.record ?? before.questions.record }) : after.questions;
  const lines = view.open
    .filter((question) => closed(question) && !known.has(question.id))
    .map((question) => `question ${QUESTION_STATE_WORDS.closed}, asked by ${senderWords(question.asker, { quoted: true })}: ${questionWords(question)}`);
  if (unread || !before.questions.recorded || !view.recorded) return lines;
  const was = new Map(before.questions.recorded.map((question) => [question.number, question.state]));
  for (const question of view.recorded) {
    if (was.get(question.number) === question.state) continue;
    if (question.state === 'answered-not-carried') lines.push(`question ${question.number} answered at ${question.answered.session.slice(0, 8)}:${question.answered.line}: not carried to ${senderWords(question.asker)} yet`);
    else if (question.state === 'closed') lines.push(`question ${question.number} closed by the user without an answer: ${clipped(question.question)}`);
  }
  return lines;
}

const pendingText = (plan) => (plan.pending.length > 0 ? plan.pending.join(', ') : 'nothing');
const START_LENGTH = 100;

const startOf = (text) => JSON.stringify(text.length > START_LENGTH ? `${text.slice(0, START_LENGTH - 1)}…` : text);

/** The tasks a plan gained, lost or has in other words, as the parts of one line: added, removed, then
 * reworded. A task is known by the id that starts its text, or by its whole text when it has none, so a
 * task with no id that is reworded reads as one removed and one added. Whether a box is ticked is not
 * looked at, nor the order of the tasks: a ticked box is the plan advancing, not changing. A plan with no
 * `tasks` (a board from before they were kept) has none to compare. */
function taskDifferences(was, plan) {
  if (!Array.isArray(was.tasks) || !Array.isArray(plan.tasks)) return [];
  const byTask = (tasks) => {
    const texts = new Map();
    for (const text of tasks) {
      const key = taskId(text) ?? text;
      texts.set(key, [...(texts.get(key) ?? []), text]);
    }
    return texts;
  };
  const old = byTask(was.tasks);
  const now = byTask(plan.tasks);
  const added = [];
  const removed = [];
  const reworded = [];
  for (const [key, texts] of now) {
    const before = old.get(key) ?? [];
    if (texts.length > before.length) added.push(...texts.slice(before.length).map((text) => `task added ${startOf(text)}`));
    else if (texts.length === before.length && texts.join('\n') !== before.join('\n')) reworded.push(`task ${key} reworded, now ${startOf(texts.join(' / '))}`);
  }
  for (const [key, texts] of old) {
    const after = now.get(key) ?? [];
    if (texts.length > after.length) removed.push(...texts.slice(after.length).map((text) => `task removed ${startOf(text)}`));
  }
  return [...added, ...removed, ...reworded];
}

/** What changed in one feature plan, as the parts of one line; empty when nothing that matters did. Its
 * counts of done and pending tasks are not among them: they change with every box a session ticks. */
function planDifferences(was, plan) {
  const parts = taskDifferences(was, plan);
  if (plan.nextStep.join('\n') !== was.nextStep.join('\n')) {
    parts.push(plan.nextStep.length === 0 ? 'its next step is now empty' : `next step now starts ${startOf(plan.nextStep[0] ?? '')}`);
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
 *   another turn, one that reaches the context pause, one that leaves the window. The waiting of a session
 *   whose last word in the record is `closed` or `relieved` is not among them (`endedSessions`);
 * - a tool call of a session that has had no result for the limit (`PENDING_CALL_LIMIT_MS`), said once when it
 *   passes the limit and again each time its age doubles (`sessionChanges`, `pendingAge`);
 * - a gate that starts beside another that runs, when one of the two does not know the machine's gate
 *   lock, among the gates of the board's worktrees (`watchedGates`, `gateChanges`);
 * - a pull request that opens or is no longer open;
 * - a feature plan that appears or stops differing from `origin/main`, one that gains or loses a task or
 *   has one reworded (`taskDifferences`), and one whose next step changed. A plan that appears or goes
 *   is said whatever its tasks: the board reads a document while it differs from `origin/main` and never
 *   the version it differs from, so it cannot tell a first ticked box from a task added, nor a merge from
 *   a change taken back;
 * - a notice for the orchestrator that the channel's record gained (`channelChanges`). This is how a
 *   notice reaches the orchestrator with no message: from a session of another permission class, whose
 *   message the app would hold, and from a host that has no messages between sessions;
 * - a question the person closed without answering (`questionChanges`): it is still open, and whoever
 *   keeps the list of his questions puts it to him again; and a recorded question answered and not carried to
 *   its asker, or closed by him without an answer, once when it gets that state.
 *
 * Everything else is left out on purpose, because it changes all the time and decides nothing: a session
 * that starts working, the age of a last entry or of a background file, the tail of a reply, a context
 * that grows below the pause, a piece of work that ends while others stay open, the counts of a worktree,
 * a gate that starts alone, stands in line for the lock, takes it or ends, a box that is ticked or
 * unticked in a plan and the counts that follow from it. The roster is not compared either: it is the sessions again,
 * whose arrival is already said, and a title that changes is a handover the sessions do themselves. Nor
 * are the notices for another role, which are that role's to read, or the messages between sessions,
 * which each session has in its own transcript.
 * `self` names the session that is watching, which is never compared: it works for as long as it watches.
 * A fact that could not be read on either side is not compared, so a failed listing is never a change. */
export function boardChanges(before, after, { self } = {}) {
  return [
    ...sessionChanges(before, after, self),
    ...gateChanges(before, after),
    ...pullRequestChanges(before, after),
    ...planChanges(before, after),
    ...channelChanges(before, after, self),
    ...questionChanges(before, after),
  ];
}

/** The open questions of the board the next look is compared with (`watchBaseline`): those of `newer`, rebuilt
 * over `sessions` (`lastReadSessions`). When `newer` could not read the channel's record and `older` had it, the
 * record and the recorded questions are the ones of `older`, unchanged. */
function questionsKept(older, newer, sessions) {
  const unread = newer.questions.record === undefined && older.questions?.record !== undefined;
  const rebuilt = openQuestionsOf(sessions, { hours: newer.questions.hours, record: newer.questions.record ?? older.questions?.record });
  return unread ? { ...rebuilt, recorded: older.questions.recorded } : rebuilt;
}

/** The board the next look is compared with: `newer`, with whatever it could not read taken from `older`.
 * Without this a transcript that was busy for one look, or one failed `gh` call, would hide the change
 * that happens across it. */
export function watchBaseline(older, newer) {
  const kept = (fact, previous) => (fact.available ? fact : previous);
  const trees = older.worktrees.available ? byKey(older.worktrees.items, 'path') : new Map();
  const plansOf = (tree) => {
    const previous = trees.get(tree.path)?.plans;
    if (tree.plans === undefined || !previous?.available) return tree.plans;
    if (!tree.plans.available) return previous;
    const old = byKey(previous.items.filter((plan) => !plan.unavailable), 'path');
    return { ...tree.plans, items: tree.plans.items.map((plan) => (plan.unavailable ? (old.get(plan.path) ?? plan) : plan)) };
  };
  const lastRead = keptMisses(older, lastReadSessions(older, newer));
  return {
    ...newer,
    sessions: lastRead,
    // The open questions follow from the transcripts: those of a session this look could not read are the
    // ones of its last readable facts, or a question closed before would be news again at the look after.
    // The channel's record is the same: a look that could not read it keeps the record of the look before and
    // its questions as that look had them, or what happened to one across the failed read would never be said.
    ...(newer.questions && { questions: questionsKept(older, newer, lastRead) }),
    // Which gates are compared depends on the worktrees (`watchedGates`): a look that could not list them
    // compared none, so its gates are not yet what the next look is compared with.
    gates: newer.worktrees.available ? kept(newer.gates, older.gates) : older.gates,
    // What the lock said last still names the folder of a gate whose command line names none (`watchedGates`).
    ...(newer.gateLock && { gateLock: newer.gateLock.available ? newer.gateLock : (older.gateLock ?? newer.gateLock) }),
    pullRequests: kept(newer.pullRequests, older.pullRequests),
    // A record that could not be read at one look has gained nothing: the count to compare with is the last one read.
    ...(newer.channel && { channel: newer.channel.unavailable !== undefined && older.channel ? older.channel : newer.channel }),
    // Nor does its roster know which sessions ended: the one made with the last record read does (`sessionChanges`).
    ...(newer.roster && { roster: newer.channel?.unavailable !== undefined && older.roster ? older.roster : newer.roster }),
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
  return `${durationOf(Math.max(0, Math.round((now - at) / 1000)))} ago`;
}

/** A duration of whole `seconds` in the words of `ago`, without the word: `45s`, `12m`, `2h 05m`, `3d`. */
function durationOf(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;
  return `${Math.floor(hours / 24)}d`;
}

/** The sentence that tells a session which must ask him a question how to ask it, given when he last wrote in the
 * transcript (`personAt`, a transcript's time, or `null`), `now` in ms and how many questions `waiting` for him. The
 * question tool holds the session until he answers, so it is called at once only when he wrote less than
 * `PERSON_PRESENT_MS` ago. Past that, the session waits for his next message and says in one line what waits, and
 * never writes the options out as text, since he answers them with the tool. A time that is not known is said so,
 * and that is the rule too: no session guesses where he is. */
export function askingRule(personAt, now, { waiting = 1 } = {}) {
  const waits = waiting === 1 ? '1 question waits' : `${waiting} questions wait`;
  const at = typeof personAt === 'string' ? Date.parse(personAt) : NaN;
  if (Number.isNaN(at)) return `when the user last wrote here is not known: call the question tool in the reply to a message of the user's; until then a reply says in one line that ${waits} and about what, and never writes the options out as text`;
  const elapsed = Math.max(0, now - at);
  const since = durationOf(Math.round(elapsed / 1000));
  if (elapsed < PERSON_PRESENT_MS) return `the user wrote here ${since} ago: put it to them now with the question tool`;
  return `the user last wrote here ${since} ago: the question tool would hold this session until the user answers, so call it in the reply to the user's next message; until then a reply says in one line that ${waits} and about what, and never writes the options out as text`;
}

/** The sentence that tells a session at the context pause whether to hand the user the cut, given when the user last
 * wrote in the transcript (`personAt`, as `askingRule` takes it) and `now` in ms. Only while the user is present, by
 * the same `PERSON_PRESENT_MS`: a session that stops for a /compact nobody sends waits for hours, and the host
 * compacts a session inside a turn anyway. */
export function cutRule(personAt, now) {
  const at = typeof personAt === 'string' ? Date.parse(personAt) : NaN;
  const keep = 'do not stop and give them nothing to send: the host compacts this session inside a turn, and your state is read after it';
  if (Number.isNaN(at)) return `when the user last wrote here is not known: ${keep}`;
  const elapsed = Math.max(0, now - at);
  const since = durationOf(Math.round(elapsed / 1000));
  if (elapsed < PERSON_PRESENT_MS) return `the user wrote here ${since} ago: give them, in your next reply, what they send to compact this session and the prompt that resumes it after`;
  return `the user last wrote here ${since} ago: ${keep}`;
}

/** `<value> <label>`, or `<label> unavailable: <reason>` for a value that could not be read. */
function counted(value, label) {
  return value?.unavailable ? `${label} unavailable: ${value.unavailable}` : `${value} ${label}`;
}

/** How the board names a piece of work: its tool, its id (`(no id yet)` until the result gives one), its kind and whether it
 * is a resumed one, and its description in quotes, as `workLine` and the hook's in-flight line print it. */
export function workNameOf(work) {
  const id = work.id ?? '(no id yet)';
  // `resumed` says the subagent was sent a follow-up and is running again, not a second subagent.
  const labels = [work.kind, work.resumed ? 'resumed' : null].filter(Boolean);
  const kind = labels.length > 0 ? ` (${labels.join(', ')})` : '';
  return `${work.tool} ${id}${kind} ${JSON.stringify(work.description ?? '')}`;
}

function workLine(work, now) {
  const file = work.file?.modifiedAt ? `file written ${ago(work.file.modifiedAt, now)}` : `file unavailable: ${work.file?.unavailable ?? 'not looked up'}`;
  return `    ${workNameOf(work)}  launched ${ago(work.launchedAt, now)}  ${file}`;
}

/** `275k` for 275,400 tokens: the board is read at a glance, and the exact count is in `--json`. */
export const thousands = (tokens) => `${Math.round(tokens / 1000)}k`;

/** A count of tokens above zero, in thousands: `under 1k` for one that rounds to none. `0k` of a room
 * would say a session has none left when it has some, and `0k past` that it is at the point when it is
 * past it; a session exactly at the point is said so in words (`contextPieces`). */
const someThousands = (tokens) => (Math.round(tokens / 1000) === 0 ? 'under 1k' : thousands(tokens));

function contextText(session, sizes) {
  const context = session.context ?? { unavailable: 'not read' };
  if (context.unavailable) return `context unavailable: ${context.unavailable}`;
  return [...contextPieces(session, sizes), ...(session.atContextPause === true ? [`at the pause: ${sizes.pause}`] : [])].join('  ');
}

/** The lines of one session. `ended` is the notice by which the session said that nothing more comes from
 * it (`closed`, or `relieved`), when the record has one as its last word (`endedSessions`): its first
 * line then says that, with the state its transcript shows beside it, so a session that closed does not
 * read as one that waits or works. */
function sessionLines(session, now, sizes, ended) {
  const id = session.id.slice(0, 8);
  // The session that asked for the board is marked: its own state is always "working", and a watch
  // leaves it out of what it compares.
  const self = session.self ? '  (this session)' : '';
  if (session.unavailable) return [`${id}  unavailable: ${session.unavailable}${self}`];
  const read = session.stateReason ? `${session.state} (${session.stateReason})` : session.state;
  const state = ended ? `${ended.kind} ${ago(ended.at, now)} by its own notice (its transcript: ${read})` : read;
  const lines = [`${id}  ${state}  ${session.title ?? '(no title)'}  last entry ${ago(session.lastEntryAt, now)}${self}`];
  const recorded = (value) => value ?? 'unavailable: no entry records it';
  // A session the person refused or stopped may wait in silence: it is said here, under its first line.
  if (session.stopped && !ended) lines.push(`  stopped ${ago(session.stopped.at, now)}: ${stopWords(session.stopped)}: it waits for the user, and tells the orchestrator what it needs`);
  lines.push(`  cwd ${recorded(session.cwd)}  branch ${recorded(session.gitBranch)}`);
  // A line of its own: it is the one read to judge whether what is left of a task fits.
  lines.push(`  ${contextText(session, sizes)}`);
  // The last automatic compaction misses a fact the proof is owed (`compactionMissOf`): said once under the block, with
  // what the reader could not know. Nothing when it misses none, or when the facts it misses are only unknown.
  const miss = session.compactionMiss;
  if (miss && miss.missed.length > 0) {
    const unknown = miss.unknown.length > 0 ? `; not known: ${miss.unknown.join(', ')}` : '';
    lines.push(`    last automatic compaction ${ago(miss.at, now)}: missed ${miss.missed.join(', ')}${unknown}`);
  }
  // A tool call that has had no result for the limit: the host may be holding it for approval, or it hangs.
  const held = pendingAge(session, now, ended);
  if (held !== null && held >= PENDING_CALL_LIMIT_MS) {
    lines.push(`  ${article(session.pendingCall.tool)} ${session.pendingCall.tool} call has had no result for ${durationOf(Math.round(held / 1000))}: the host may be holding it for approval, or it hangs`);
  }

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

/** The roster's last line: what no transcript tells it, so a row is never read as "this session is there". */
export const ROSTER_NOT_KNOWN =
  'Not known from here: whether a silent session is alive or archived (nothing outside a session lists the sessions of the app; a session that closed or was relieved said so in the record), whether the transcripts of one row are one session the app restarted or several sessions under one title (either one arrives with a new session id, so the record does not tell), and the worktree a session reaches by `cd`, unless a notice of the session says it (`folder` is the one its entries record).';

/** The sessions of `board` whose row of the roster ends with `closed` or `relieved` in the record, as a
 * `Map` from a transcript's id to that notice (`{ kind, at, text }`). It is the row's word, so every
 * transcript of the row has it: the transcripts of a row are not told apart (`ROSTER_NOT_KNOWN`). */
function endedSessions(board) {
  const ended = new Map();
  for (const row of board.roster?.rows ?? []) {
    if (!row.record?.status || !ENDED_KINDS.has(row.record.status.kind)) continue;
    for (const transcript of row.transcripts) ended.set(transcript.id, row.record.status);
  }
  return ended;
}

/** What the record says of a row, as its third line in the roster, or none: its last state with its age
 * and its text (on what it waits, what it delivered, who has the role now), then the worktree and the
 * branch its notices were written from. */
function recordLine(record, now) {
  if (!record) return [];
  const { status } = record;
  const state = status ? `${status.kind}${status.kind === 'waiting' ? ' since' : ''} ${ago(status.at, now)}: ${clipped(status.text)}` : null;
  const place = record.worktree === null ? null : `notices written from ${record.worktree}${record.branch === null ? ', no branch read' : ` on ${record.branch}`}`;
  const parts = [state, place].filter(Boolean);
  return parts.length === 0 ? [] : [`    record: ${parts.join('  ')}`];
}

const OPENED_WORDS = { his: 'opened by him', session: 'opened by a session', command: 'opened by a command', scheduled: 'opened by a scheduled task', unknown: 'opened unknown' };
const WHERE_WORDS = { sessions: 'in Sessions', routines: 'in Routines', archived: 'archived', 'not-in-app': 'not in the app', unknown: 'where unknown' };

/** The line under a row's mode line: how its session was opened, where the app keeps it and its effort, then
 * the marks that it is not in his sidebar (in Routines, or not in the app) and that its effort is below `high`
 * (on a session he did not open himself). */
function openerLine(row) {
  const marks = [];
  if (row.where === 'routines' || row.where === 'not-in-app') marks.push('NOT IN HIS SIDEBAR');
  if ((row.effort === 'low' || row.effort === 'medium') && row.opened !== 'his') marks.push('effort below high');
  const effort = row.effort === null ? 'effort unknown' : `effort ${row.effort}`;
  return `    ${[OPENED_WORDS[row.opened] ?? OPENED_WORDS.unknown, WHERE_WORDS[row.where] ?? WHERE_WORDS.unknown, effort, ...marks].join('  ')}`;
}

/** The `Roster` section: per row of `rosterOf`, a title line, then the mode line with `openerLine` after it, and a further one for a row the record says something
 * of (`recordLine`). The first has the role, the title and how long the session has been silent, never
 * that it is alive, which no transcript says; the session that asked is the one exception, and is said
 * to be this one. A row whose last word in the record is `closed` or `relieved` says that, with its age,
 * in the place of its silence. A row with no role says why it has none. The second
 * has the permission mode, the folder and the branch the entries record, the feature of that branch when
 * it is known, and the transcripts of the row, each with its age when there are several. It says
 * `folder` and not `worktree`: that is where the session was opened, and one that works in a worktree it
 * reached by `cd` records the other (every session of this project did, 2026-10-11). Then one line when
 * more than one row holds the orchestrator's role, since a message to the orchestrator then has no
 * single address; the transcripts that could not be read, and those of the window with no entry in it
 * (`rosterOf`); and what the roster cannot know (`ROSTER_NOT_KNOWN`). */
function rosterLines(roster, now) {
  if (roster.rows.length === 0 && roster.unread === 0 && roster.outside === 0) return ['Roster', '  no session', ''];
  const inNoRow = (count, what) => `  ${count} transcript${count === 1 ? '' : 's'} ${what} ${count === 1 ? 'is' : 'are'} in no row`;
  const short = (id) => id.slice(0, 8);
  const lines = ['Roster'];
  for (const row of roster.rows) {
    const role = row.role === 'orchestrator' ? 'orchestrator' : row.role === 'work' ? `work ${row.number}` : 'no role';
    const last = row.lastEntryAt === null ? null : ago(row.lastEntryAt, now);
    const lastEntry = last === null ? '' : `, last entry ${last}`;
    // A row that closed or was relieved says that, and not for how long it has been silent.
    const status = row.record?.status;
    const ended = status && ENDED_KINDS.has(status.kind) ? `${status.kind} ${ago(status.at, now)}` : null;
    const silent = last === null ? 'silent, no entry of it has a time' : `silent since ${last}`;
    const activity = row.self ? `this session${ended ? `, ${ended}` : ''}${lastEntry}` : ended ? `${ended}${lastEntry}` : silent;
    const given = row.titleSource === 'custom-title' || row.titleSource === 'reading';
    const noRole = given ? `its title is not "${TITLE_WORDS}"` : row.titleSource === 'first-prompt' ? 'it has no title: this is the start of its first prompt' : 'it has no title';
    lines.push(`  ${role}  ${row.title ?? '(no title)'}  ${activity}${row.role === null ? `  (${noRole})` : ''}`);
    const feature = row.features.length > 0 ? `  feature ${row.features.join(', ')}` : '';
    const transcripts = row.transcripts.length === 1 ? `transcript ${short(row.transcripts[0].id)}` : `transcripts ${row.transcripts.map((transcript) => `${short(transcript.id)} (${ago(transcript.lastEntryAt, now)})`).join(', ')}`;
    // A title no transcript of the row carries is the one of the opening its session read (`titledByReadings`).
    const read = row.titleSource === 'reading' ? '  title from the opening it read' : '';
    lines.push(`    mode ${row.permissionMode ?? 'unknown'}  folder ${row.cwd ?? 'unknown'}  branch ${row.gitBranch ?? 'unknown'}${feature}  ${transcripts}${read}`, openerLine(row), ...recordLine(row.record, now));
  }
  const orchestrators = roster.rows.filter((row) => row.role === 'orchestrator');
  if (orchestrators.length > 1) {
    lines.push(`  ${orchestrators.length} sessions carry the orchestrator's title: ${orchestrators.map((row) => JSON.stringify(row.title)).join(', ')}. A message to the orchestrator has no single address.`);
  }
  if (roster.unread > 0) lines.push(inNoRow(roster.unread, 'that could not be read'));
  if (roster.outside > 0) lines.push(inNoRow(roster.outside, 'with no entry inside the window'));
  lines.push(`  ${ROSTER_NOT_KNOWN}`, '');
  return lines;
}

/** The channel's last line: what a notice is, and what a transcript cannot show of a message. */
export const CHANNEL_NOT_KNOWN =
  "A notice is what a session says, never the user's word. A message not seen arrived in no transcript of the window: whether the app keeps it back, it expired or it reached a session outside the window cannot be read from here.";

const STATE_WORDS = { arrived: 'arrived', failed: 'failed', 'not-seen': 'not seen in a transcript of the window' };

/** The `Channel` section, or no lines when there is nothing to show: no notice in the record, no line of
 * it skipped, no message between sessions, and a record that could be read.
 *
 * First the record, with its path: how many notices it holds and the last ones (`channelOf`), each with
 * its age, who wrote it, the role it is for, its kind and its text; an answer also says where the user's
 * words are read, which is what `sessions --quote` takes. Then the messages between sessions seen in the
 * transcripts: age, from whom, to which address, whether it was seen to arrive (and at which session,
 * when that is not the address), and the line its call gave about it. Last, `CHANNEL_NOT_KNOWN`. */
function channelLines(channel, now) {
  if (!channel) return [];
  const unread = channel.unavailable !== undefined;
  if (!unread && channel.noticeCount === 0 && channel.skipped === 0 && channel.messageCount === 0) return [];
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
  const lastOf = (total, shown) => (shown < total ? `, the last ${shown}` : '');
  const lines = ['Channel'];
  if (unread) lines.push(`  ${channel.path}  unavailable: ${channel.unavailable}`);
  else if (channel.noticeCount > 0) lines.push(`  ${channel.path}  ${plural(channel.noticeCount, 'notice')}${lastOf(channel.noticeCount, channel.notices.length)}:`);
  else if (channel.skipped > 0) lines.push(`  ${channel.path}  no notice`);
  for (const notice of channel.notices) {
    const to = notice.to.role === 'orchestrator' ? 'orchestrator' : `work ${notice.to.number}`;
    const read = notice.kind === 'answer' && notice.transcript !== undefined ? `  (the user's words: transcript ${notice.transcript}, line ${notice.line})` : '';
    lines.push(`  | ${ago(notice.at, now)}  ${senderWords(notice.from)}${shareWords(notice.from)} to ${to}  ${notice.kind}  ${clipped(notice.text)}${read}`);
  }
  if (channel.skipped > 0) lines.push(`  ${channel.skipped} line${channel.skipped === 1 ? ' of the record is' : 's of the record are'} neither a notice nor a reading: skipped`);
  if (channel.messageCount > 0) lines.push(`  ${plural(channel.messageCount, 'message')} between sessions in the transcripts of the window${lastOf(channel.messageCount, channel.messages.length)}:`);
  const named = (who) => who.title ?? (who.session === null ? null : `session ${who.session.slice(0, 8)}`);
  for (const message of channel.messages) {
    const to = message.to.address ?? named(message.to) ?? 'an unknown address';
    const receiver = named(message.to);
    const state = message.state === 'arrived' && receiver !== null && receiver !== to ? `arrived at ${receiver}` : STATE_WORDS[message.state];
    lines.push(`  | ${ago(message.at, now)}  ${named(message.from) ?? 'an unknown session'} to ${to}  ${state}${message.summary === null ? '' : `  ${JSON.stringify(message.summary)}`}`);
  }
  lines.push(`  ${CHANNEL_NOT_KNOWN}`, '');
  return lines;
}

/** The session a gate hangs from, as its line in `Gates` says it after what the gate does, or nothing
 * for a board with no roster. A gate is a process, and nothing a process carries names a session: what
 * ties the two is the folder. So it is the row of the roster whose notices were written from the folder
 * the gate checks (`record.worktree`, where the session really works), or the row whose transcript
 * records that folder and whose notices place it nowhere else. Several such rows are all named, as one
 * of them, and when they are of both kinds each is named with what places it (Codex review of 7a19710:
 * the first kind alone was named, as if a notice made the folder's processes that session's); none is
 * said as not known, never left out. This is what lets a gate that waits
 * for the machine be told from a leftover of another session (failure 7 of 2026-10-10: the board
 * printed neither a wait's owner nor its pid). */
function gateSession(gate, roster) {
  if (!roster) return [];
  if (gate.worktree?.unavailable) return ['session not known: the gate names no folder'];
  const folder = comparable(String(gate.worktree));
  const name = (row) => row.title ?? `transcript ${row.transcripts[0].id.slice(0, 8)}`;
  const byNotices = roster.rows.filter((row) => typeof row.record?.worktree === 'string' && comparable(row.record.worktree) === folder);
  const byFolder = roster.rows.filter((row) => typeof row.record?.worktree !== 'string' && typeof row.cwd === 'string' && comparable(row.cwd) === folder);
  const NOTICES = ['its notices were written from this folder', 'whose notices were written from this folder'];
  const FOLDER = ['its transcript records this folder', 'whose transcripts record this folder'];
  // A notice says where a session works, not that the processes of that folder are its own: a session
  // opened in the folder could have started the gate too, so both kinds are candidates, each with what
  // places it.
  if (byNotices.length > 0 && byFolder.length > 0) {
    const placed = [...byNotices.map((row) => `${name(row)} (${NOTICES[0]})`), ...byFolder.map((row) => `${name(row)} (${FOLDER[0]})`)];
    return [`one of ${placed.length} sessions in this folder: ${placed.join(', ')}`];
  }
  const [rows, [how, shared]] = byNotices.length > 0 ? [byNotices, NOTICES] : [byFolder, FOLDER];
  if (rows.length === 0) return ['session not known: no row of the roster is in this folder'];
  return [rows.length === 1 ? `session ${name(rows[0])} (${how})` : `one of ${rows.length} sessions ${shared}: ${rows.map(name).join(', ')}`];
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
    // After what the gate does, the session it hangs from: a gate that waits is otherwise a pid nobody owns.
    return [`  ${gate.pid === null ? 'pid unknown' : `pid ${gate.pid}`}`, worktree, gateState(gate, now, lockRead, lockNow), ...gateSession(gate, board.roster), command].join('  ');
  });
  if (!board.gates.available) lines.push(`  unavailable: ${board.gates.reason}`);
  else if (lines.length === 0) lines.push('  none running');
  if (board.gateLock && !board.gateLock.available) lines.push(`  unavailable: ${board.gateLock.reason}`);
  return ['Gates', ...lines, ''];
}

const QUESTION_STATE_WORDS = { closed: 'closed by the user without an answer', pending: 'on the user\'s screen, no answer yet', unanswered: 'no answer in its result' };

/** The text of an open question as a line carries it: the first one its call asked, cut to a line's
 * width, and how many more the same call asked. */
const questionWords = ({ question, more }) => `${clipped(question)}${more > 0 ? ` (and ${more} more in the same call)` : ''}`;

/** A recorded question's state in words: a question that is not shown yet, or one answered and not carried yet, says
 * where the answer is; the others are said as a line of the transcripts says them. */
function recordedStateWords({ state, answered }) {
  if (state === 'not-shown') return 'recorded, not shown to the user yet';
  if (state === 'answered-not-carried') return `answered at ${answered.session.slice(0, 8)}:${answered.line}, not carried yet`;
  return QUESTION_STATE_WORDS[state];
}

/** The recorded questions' states that wait for him to be asked again or for the first time: not shown yet, closed by
 * him without an answer, or with no answer in their result. The others are answered, or on his screen. */
const TO_ASK_STATES = new Set(['not-shown', 'closed', 'unanswered']);

/** The `Open questions` section (`openQuestionsOf`): first the questions the channel's record holds that no notice
 * has closed (`Pregunta <n>`, when the notice was written, who asked, what became of it and the text), then a line
 * for each question put to the person that has no answer of his, oldest first, with how long ago it was asked, who
 * asked, what became of it and the first text asked. When any recorded question waits to be asked, one line says how
 * to ask him (`askingRule`), from the board's own session `self` when it has one; then what was read, since an empty
 * list from one transcript is not one from fifty. `none` only when neither list has a row. No section for a board that
 * holds no such key. */
function openQuestionLines(questions, now, self = null) {
  if (!questions) return [];
  const asker = ({ id, title }) => title ?? `transcript ${String(id).slice(0, 8)}`;
  const recorded = (questions.recorded ?? []).map((question) => `  ${QUESTION_WORD} ${question.number}  ${ago(question.at, now)}  ${senderWords(question.asker)}  ${recordedStateWords(question)}  ${clipped(question.question)}`);
  const rows = questions.open.map((question) => `  ${question.at === null ? 'time not recorded' : ago(question.at, now)}  ${asker(question.asker)}  ${QUESTION_STATE_WORDS[question.state]}  ${questionWords(question)}`);
  const waiting = (questions.recorded ?? []).filter((question) => TO_ASK_STATES.has(question.state)).length;
  const toAsk = waiting > 0 ? [`  to ask: ${askingRule(self?.personAt ?? null, now, { waiting })}`] : [];
  const read = `  read in ${questions.transcripts} transcript${questions.transcripts === 1 ? '' : 's'} changed in the last ${questions.hours}h, each read whole`;
  return ['Open questions', ...(recorded.length + rows.length > 0 ? [...recorded, ...rows] : ['  none']), ...toAsk, read, ''];
}

/** The board as lines of text: the sessions (in the order given, most recent first), the roster of
 * those sessions by role when the board has one, the channel when it has something to show, the
 * questions the record holds and the questions put to the person that have no answer when the board has that list, then worktrees, the
 * gates that run and wait, open pull requests and the orchestrator's relief file, and a last line that
 * says what the board cannot see. */

/** The board's opening column: every session whose context was read, the fullest first, with the share it holds of the
 * window, the room left before the host compacts it, its id and title, and whether it is past the pause. The app no
 * longer shows a session's context, and the rows below say it one session at a time; a session whose context was
 * not read is counted, and its row says why. Nothing when no session's context was read. */
function contextColumnLines(board) {
  const window = board.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  const read = board.sessions.filter((session) => Number.isFinite(session.context?.tokens));
  if (read.length === 0) return [];
  const roomOf = (session) => {
    if (!Number.isFinite(session.contextRoom)) return 'room not known';
    return session.contextRoom > 0 ? `room ${someThousands(session.contextRoom)}` : 'no room';
  };
  const rows = [...read].sort((a, b) => b.context.tokens - a.context.tokens).map((session) => {
    const share = `${String(percentOf(session.context.tokens, window)).padStart(3)}%`;
    const marks = [session.atContextPause ? '  past the pause' : '', session.self === true ? '  (this session)' : ''].join('');
    return `  ${share}  ${roomOf(session).padEnd(12)}  ${session.id.slice(0, 8)}  ${session.title ?? '(no title)'}${marks}`;
  });
  const unread = board.sessions.length - read.length;
  return [
    'Context  the share each session holds of its window and the room left before the host compacts it, the fullest first',
    ...rows,
    ...(unread > 0 ? [`  ${unread} session${unread === 1 ? '' : 's'} whose context was not read: ${unread === 1 ? 'its row says' : 'their rows say'} why`] : []),
    '',
  ];
}

export function renderBoard(board, { now }) {
  const lines = [`Sessions  ${board.root}  ${board.sessions.length} changed in the last ${board.hours}h`, '', ...contextColumnLines(board)];
  const sizes = contextSizes(board);
  const ended = endedSessions(board);
  for (const session of board.sessions) lines.push(...sessionLines(session, now, sizes, ended.get(session.id)), '');

  lines.push(
    ...(board.roster ? rosterLines(board.roster, now) : []),
    ...channelLines(board.channel, now),
    ...openQuestionLines(board.questions, now, board.sessions.find((session) => session.self === true) ?? null),
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
