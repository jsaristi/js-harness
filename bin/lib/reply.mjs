// The reply check, C1 of odd/tasks/rule-hierarchy.md (T2): whether the reply that ends a turn closes the way
// protocol 2 of `js-harness-protocols` asks, "End each reply in one of the five states", read from the reply's text alone. It never judges what a reply
// says, only its close: one state line, what that state needs, and the block the user sends kept to a cut.
//
// A state line is a line, outside fenced blocks, that starts with a state's label once the markdown around it is
// taken off (`**Sigo solo** — …`, `## Terminado: …`, `- Corte`); a label inside a sentence or as part of a longer
// word is none. The labels are the project's, from the `reply` key of its `harness.json`, so a project that writes
// its replies in Spanish declares the Spanish ones. What each state needs, from protocol 2:
//   - working: what wakes the session, written after the label on its line;
//   - decision: never while background work runs (the host's count of running tasks);
//   - question: an open question the user answers in writing, not with the question tool's buttons, written after
//     the label on its line; it may close while background work runs, since the person answers it, not the work;
//   - cut: one fenced block of what the user sends, under the three labels (what it is, where it goes, what sending it
//     does), each once;
//   - finished: the session to return to, written after the label on its line.
// The three labels of a block belong to a cut alone: a decision is asked with the question tool, not with a block.

/** The labels a project gets with `"reply": true`. */
export const DEFAULT_REPLY = Object.freeze({
  states: Object.freeze({ working: 'Working', decision: 'Decision', question: 'Question', cut: 'Cut', finished: 'Finished' }),
  labels: Object.freeze({ what: 'What it is', where: 'Where it goes', effect: 'What sending it does' }),
});

const STATES = Object.keys(DEFAULT_REPLY.states);
const LABELS = Object.keys(DEFAULT_REPLY.labels);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** One group (`states` or `labels`) of the `reply` key over its defaults, or the reason it cannot be read. */
function groupOf(given, name, keys) {
  if (given === undefined) return { value: { ...DEFAULT_REPLY[name] } };
  if (!isObject(given)) return { error: `"${name}" is not an object` };
  const value = { ...DEFAULT_REPLY[name] };
  for (const [key, label] of Object.entries(given)) {
    if (!keys.includes(key)) return { error: `"${name}" has "${key}", which is none of ${keys.join(', ')}` };
    if (typeof label !== 'string' || label.trim() === '') return { error: `"${name}.${key}" is not a label (a text that is not blank)` };
    value[key] = label.trim();
  }
  return { value };
}

/** The reply check a project's `harness.json` (parsed) asks for: `null` when it has no `reply` key or the key is
 * `false`; the labels when it is `true` (the English ones) or an object (`states` and `labels`, each label it names
 * over the English one); `{ error }` when the key cannot be read, so no check runs on guessed labels. */
export function replyConfig(harness) {
  if (!isObject(harness) || harness.reply === undefined || harness.reply === false) return null;
  const { reply } = harness;
  const failed = (why) => ({ error: `harness.json "reply": ${why}` });
  if (reply === true) return { states: { ...DEFAULT_REPLY.states }, labels: { ...DEFAULT_REPLY.labels } };
  if (!isObject(reply)) return failed('expected true, false or an object with "states" and "labels"');
  const extra = Object.keys(reply).find((key) => key !== 'states' && key !== 'labels');
  if (extra !== undefined) return failed(`"${extra}" is neither "states" nor "labels"`);
  const states = groupOf(reply.states, 'states', STATES);
  if (states.error) return failed(states.error);
  const labels = groupOf(reply.labels, 'labels', LABELS);
  if (labels.error) return failed(labels.error);
  const all = [...Object.values(states.value), ...Object.values(labels.value)].map((label) => label.toLowerCase());
  const twice = all.find((label, i) => all.indexOf(label) !== i);
  if (twice !== undefined) return failed(`two states or labels share "${twice}", so they could not be told apart`);
  // "Sigo" and "Sigo solo": the line "Sigo solo — …" would start with both.
  for (const short of all) {
    const long = all.find((label) => label !== short && label.startsWith(short) && !/[\p{L}\p{N}]/u.test(label[short.length]));
    if (long !== undefined) return failed(`"${short}" begins "${long}", so one line would match both`);
  }
  return { states: states.value, labels: labels.value };
}

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The text of a line with the markdown around its start taken off: quote marks, a heading's hashes, a list marker
 * and emphasis. */
const bare = (line) => line.replace(/^\s*(?:>\s*)*(?:#{1,6}\s+)?(?:(?:[-*+]|\d+[.)])\s+)?(?:[*_]{1,3})?/, '');

/** Whether `text` starts with `label` as a whole word, whatever its case: what follows is no letter or digit. */
function startsWithLabel(text, label) {
  // After the label and its emphasis comes the end of the line or a mark that joins what follows ("Working —",
  // "Qué es:"), so a sentence that only begins with the word ("Working on the docs") is body text, not a state.
  return new RegExp(`^${escaped(label)}[*_]*\\s*(?:$|[—–:.,;!-])`, 'iu').test(text);
}

/** What follows `label` on its line, with the punctuation and emphasis that join them taken off. */
const restAfter = (text, label) => text.slice(label.length).replace(/^[\s*_:.,;—–-]+/u, '').replace(/[\s*_]+$/u, '');

/** The lines of `text` with, for each, whether it lies in a fenced block (its fences included), and the blocks as
 * `{ start, end, body }` (the line numbers of their fences). An unclosed fence runs to the end. */
function linesOf(text) {
  const lines = text.split(/\r?\n/);
  const fenced = lines.map(() => false);
  const blocks = [];
  let open = null;
  lines.forEach((raw, i) => {
    // A fence a quote holds (`> ```) is a fence too; `bare` would take the quote marks off its lines.
    const line = raw.replace(/^\s*(?:>\s?)+/, '');
    const fence = /^\s*(`{3,}|~{3,})/.exec(line);
    if (open === null && fence) {
      open = { start: i, mark: fence[1], info: line.trim().slice(fence[1].length).trim() };
      fenced[i] = true;
      return;
    }
    if (open !== null) {
      fenced[i] = true;
      if (fence && fence[1][0] === open.mark[0] && fence[1].length >= open.mark.length && line.trim() === fence[1]) {
        blocks.push({ start: open.start, end: i, info: open.info, body: lines.slice(open.start + 1, i).join('\n') });
        open = null;
      }
    }
  });
  if (open !== null) blocks.push({ start: open.start, end: lines.length - 1, info: open.info, body: lines.slice(open.start + 1).join('\n') });
  return { lines, fenced, blocks };
}

/** The fenced blocks of a reply's `text`, as `{ start, end, info, body }`: the line numbers of their fences, the
 * fence's info string (`powershell own`) and what it holds. The command-block check reads them
 * (bin/lib/reply-commands.mjs). */
export const fencedBlocks = (text) => linesOf(String(text ?? '')).blocks;

/** The shape every refusal ends with: the five states and what each needs, in the project's labels. */
function shapeOf({ states, labels }) {
  return `End the reply with one line that starts with one of: ${states.working} (say what wakes you), `
    + `${states.decision} (never while background work runs; the question itself goes through the question tool), `
    + `${states.question} (an open question the user answers in writing, asked on that line), `
    + `${states.cut} (one code block of only what the user sends, under the lines ${labels.what}:, ${labels.where}: and ${labels.effect}:), `
    + `${states.finished} (name the session to return to). Your reply is already shown: write the close again in your next words.`;
}

/** The state lines and the label lines of a reply's `lines`, outside its fenced blocks. */
function closesOf(lines, fenced, { states, labels }) {
  const found = [];
  const labelLines = [];
  lines.forEach((line, i) => {
    if (fenced[i]) return;
    const plain = bare(line);
    for (const state of STATES) {
      if (startsWithLabel(plain, states[state])) found.push({ state, line: i, rest: restAfter(plain, states[state]) });
    }
    for (const label of LABELS) {
      if (startsWithLabel(plain, labels[label])) labelLines.push({ label, line: i });
    }
  });
  return { found, labelLines };
}

/** The state the reply `text` closes with in the project's labels of `config` (`working`, `decision`, `question`,
 * `cut` or `finished`), or `null` when it has none or more than one. */
export function closingState(text, config) {
  const { lines, fenced } = linesOf(String(text ?? ''));
  const { found } = closesOf(lines, fenced, config);
  return found.length === 1 ? found[0].state : null;
}

/** Why the reply `text` does not close as the project's labels in `config` ask, or `null` when it does. `running`
 * is how many background tasks of the session run as it stops (the host's `background_tasks`; Codex sends none). */
export function replyRefusal(text, config, { running = 0 } = {}) {
  const { lines, fenced, blocks } = linesOf(String(text ?? ''));
  const { states, labels } = config;
  const turned = (why) => `js-harness reply: ${why}. ${shapeOf(config)}`;
  const { found, labelLines } = closesOf(lines, fenced, config);

  if (found.length === 0) return turned('the reply has no state line');
  if (found.length > 1) return turned(`the reply has more than one state line (${found.map(({ state }) => states[state]).join(', ')}); it closes with exactly one`);
  const [{ state, line: at, rest }] = found;

  if (state !== 'cut') {
    // The close is the last paragraph: no blank line between the state line and a later line outside a block.
    let blank = false;
    for (let i = at + 1; i < lines.length; i += 1) {
      if (lines[i].trim() === '') blank = true;
      else if (blank) return turned(`the reply does not end with its state: "${states[state]}" is followed by another paragraph`);
    }
    if (labelLines.length > 0) {
      return turned(`a block for the user under ${labels.what}, ${labels.where} and ${labels.effect} belongs to a cut, never to "${states[state]}"; a decision is asked with the question tool`);
    }
  }
  if (state === 'working' && rest === '') return turned(`"${states.working}" says nothing after it: say on that line what wakes you`);
  if (state === 'finished' && rest === '') return turned(`"${states.finished}" says nothing after it: name on that line the session to return to`);
  if (state === 'question' && rest === '') return turned(`"${states.question}" says nothing after it: write on that line what you ask`);
  if (state === 'decision' && running > 0) {
    return turned(`"${states.decision}" while ${running} background ${running === 1 ? 'task runs' : 'tasks run'}: a decision is never asked while work runs; wait for it, or close with ${states.working}`);
  }
  if (state === 'cut') return cutRefusal({ labels, labelLines, blocks, turned });
  return null;
}

/** Why a cut's block is not one fenced block under the three labels, each once, or `null`. */
function cutRefusal({ labels, labelLines, blocks, turned }) {
  for (const label of LABELS) {
    const seen = labelLines.filter((entry) => entry.label === label).length;
    if (seen === 0) return turned(`the cut has no line ${labels[label]}: above its block`);
    if (seen > 1) return turned(`the cut has the line ${labels[label]}: twice`);
  }
  const lastLabel = Math.max(...labelLines.map((entry) => entry.line));
  const under = blocks.filter((block) => block.start > lastLabel);
  if (under.length === 0) return turned('the cut has no block under its labels');
  if (under.length > 1) return turned(`the cut has ${under.length} blocks under its labels; it carries one block, so two are never sent out of order`);
  if (under[0].body.trim() === '') return turned('the cut\'s block is empty');
  return null;
}
