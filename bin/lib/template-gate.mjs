// The template gate's decisions (odd/tasks/templates.md, "The gates on the path to him"): what a host tool call is
// about to show the user, and whether a template command made it. This module holds the `page` surface (an `Artifact`
// publish of a page, an `mcp__visualize__show_widget`) and the `ask` surface (a call of the question tool), and reads
// which `ArtifactData` call writes the board's summary, which `--shown` records (odd/tasks/board-summary-stale.md);
// `bin/template.mjs` reads the files and the records and writes the decision. Pure: it is handed the page's text, the
// rendered lines, the registry, the open moments and the channel's questions.
import path from 'node:path';
import { normalText, sha256 } from './template.mjs';
import { admit } from './template-question.mjs';
import { SUMMARY_SUBJECT } from './template-record.mjs';

/** How old a rendered line may be and still admit its page: an old page published again as a new moment's is refused. */
export const RENDERED_FRESH_HOURS = 6;

/** The shortest reason a free page gives. */
export const FREE_REASON_CHARS = 20;

// Each attribute ends at the quote that opened it, so an apostrophe inside a double-quoted reason is part of it, and a
// reason may wrap onto the next line.
const FREE_MARK = /<meta\s+name\s*=\s*(["'])js-harness-page\1\s+content\s*=\s*(["'])free:\s*((?:(?!\2)[\s\S])*)\2\s*\/?>/i;
const MARK_TEXT = '<meta name="js-harness-page" content="free: <why, 20 characters or more>">';

/** The reason of a page's free mark, or `null` when it has none or its reason is under `FREE_REASON_CHARS`. */
export function freeReason(text) {
  const reason = FREE_MARK.exec(text)?.[3]?.trim();
  return reason !== undefined && reason.length >= FREE_REASON_CHARS ? reason : null;
}

const isPage = (file) => typeof file === 'string' && /\.(?:html?|md)$/i.test(file);

/** What a call of `tool` with `input` shows as a page: `{ files }`, the local files an `Artifact` publish sends as
 * pages (the page itself and each `.html` or `.md` of its `files`, a map or a list, a relative one under its `root`),
 * or `{ widget }`, a widget's code; `null` when the call shows no page (a read, an open, a list, a quickstart, an asset
 * upload, a create from a type, a data file). */
export function pageTarget(tool, input) {
  if (tool === 'mcp__visualize__show_widget') return typeof input?.widget_code === 'string' ? { widget: input.widget_code } : null;
  if (tool !== 'Artifact' || input === null || typeof input !== 'object') return null;
  if ((input.action ?? 'publish') !== 'publish' || input.asset === true) return null;
  const files = [];
  if (isPage(input.file_path)) files.push(input.file_path);
  // A list publishes each `{ path }` at its own spelling; a map's value is a path or `{ from }` (an `{ artifact }` copy
  // is another artifact's file, never a local page).
  const sources = Array.isArray(input.files) ? input.files.map((entry) => entry?.path)
    : input.files !== null && typeof input.files === 'object' ? Object.values(input.files).map((source) => (typeof source === 'string' ? source : source?.from)) : [];
  const root = typeof input.root === 'string' && input.root !== '' ? input.root : null;
  for (const file of sources.filter(isPage)) files.push(root !== null && !path.isAbsolute(file) ? path.join(root, file) : file);
  return files.length > 0 ? { files } : null;
}

const WRITES = ['set', 'update', 'str_replace', 'delete'];
const isSummary = (write) => write?.collection === 'board' && write.doc_id === 'summary';

/** What a call of `tool` with `input` writes to the board's summary (collection `board`, document `summary`): each
 * write's `action` and its source, `data` (its object), `file` (a local JSON file), `field` (a `str_replace`'s) or none
 * (a delete), a `batch`'s entries in order; `null` when the call writes no summary (a read, another document). */
export function summaryChanges(tool, input) {
  if (tool !== 'ArtifactData' || input === null || typeof input !== 'object') return null;
  const writes = input.action === 'batch' ? (Array.isArray(input.writes) ? input.writes.map((entry) => ({ ...entry, action: entry?.op })) : [])
    : [input];
  const changes = writes.filter((write) => isSummary(write) && WRITES.includes(write.action)).map(({ action, ...write }) => {
    if (action === 'str_replace') return { action, field: write.field };
    if (action === 'delete') return { action };
    if (write.data !== null && typeof write.data === 'object') return { action, data: write.data };
    return typeof write.file_path === 'string' ? { action, file: write.file_path } : { action };
  });
  return changes.length > 0 ? changes : null;
}

// The directives audit, C4 (odd/tasks/audit-cement.md, spec 6): an item of the summary's `yours`, what is his on the
// board, left it with no word of why. The gate reads each write of the summary before the call and lets an item leave
// only when the same write names it in `yoursDropped: [{ item, reason }]`.

/** The level the board shows an item of `yours` under (`yoursLevel` of docs/live-board.html, held to it by a test). */
export const YOURS_LEVEL = /^(urgente|prioritario|opciones)\s*[·:\-–]\s*(\S[\s\S]*)$/i;

/** The shortest reason that lets an item leave `yours`. */
export const DROP_REASON_CHARS = 10;

/** An item of `yours` as the gate tells items apart: its text without the level, trimmed. */
export const yoursKey = (item) => (YOURS_LEVEL.exec(String(item))?.[2] ?? String(item)).trim();

const givenReason = (entry) => typeof entry?.item === 'string' && typeof entry.reason === 'string' && entry.reason.trim().length >= DROP_REASON_CHARS;

/** What one summary change (`summaryChanges`, its `file` read into `data` or into `unreadable`, why not) does to
 * `yours`: `{ yours, named, why }`. `yours` is the list it leaves, its strings, as the board lists them; `undefined`
 * when it does not touch it, `null` when that cannot be known (a `str_replace` of it, a file not read), and then `why`
 * says why. A `set` without it, or a `delete`, empties it. `named` is its own `yoursDropped` entries whose reason is
 * `DROP_REASON_CHARS` or more. */
function yoursOf(change) {
  if (change.action === 'delete') return { yours: [], named: [] };
  if (change.action === 'str_replace') return change.field === 'yours' ? { yours: null, named: [], why: 'a str_replace of yours' } : { yours: undefined, named: [] };
  if (change.unreadable !== undefined) return { yours: null, named: [], why: change.unreadable };
  const data = change.data !== null && typeof change.data === 'object' ? change.data : {};
  const named = Array.isArray(data.yoursDropped) ? data.yoursDropped.filter(givenReason) : [];
  if (Object.hasOwn(data, 'yours')) return { yours: Array.isArray(data.yours) ? data.yours.filter((item) => typeof item === 'string') : [], named };
  return { yours: change.action === 'set' ? [] : undefined, named };
}

/** What the summary changes `changes` leave of `yours`, in order: `{ yours, named }`, `yours` the list after the last
 * that touched it (`yoursOf`), `named` the reasons each of those gave. */
export function yoursAfter(changes) {
  let yours;
  const named = [];
  for (const step of changes.map(yoursOf)) {
    if (step.yours === undefined) continue;
    yours = step.yours;
    named.push(...step.named);
  }
  return { yours, named };
}

/** The decision on a call's writes of the summary, `{ decision, yours, reason }`: `refused` when a write drops an item
 * of the list before it and does not name it in its own `yoursDropped` (a reason another write of the batch gives is
 * not its own), with the text that names each; `unchecked` when the list before or after a write cannot be known;
 * `admitted` otherwise. `previous` is the last list recorded (`lastYours`): `undefined` when none was, `null` when it
 * is not known, and then `previousWhy` says why. */
export function decideSummary({ changes, previous, previousWhy = 'the last recorded yours is not known' }) {
  // A str_replace of yours leaves a list the record cannot know, which the next write would then be held to nothing by.
  if (changes.some((change) => change.action === 'str_replace' && change.field === 'yours')) {
    return { decision: 'refused', yours: null, reason: say('whole') };
  }
  let list = previous;
  let unknown = null;
  const dropped = new Set();
  for (const step of changes.map(yoursOf)) {
    if (step.yours === undefined) continue;
    if (Array.isArray(list) && Array.isArray(step.yours)) {
      const kept = new Set(step.yours.map(yoursKey));
      const given = new Set(step.named.map((entry) => yoursKey(entry.item)));
      for (const key of list.map(yoursKey)) if (key !== '' && !kept.has(key) && !given.has(key)) dropped.add(key);
    } else if (list !== undefined) unknown ??= list === null ? previousWhy : step.why;
    list = step.yours;
  }
  const { yours } = yoursAfter(changes);
  if (dropped.size > 0) {
    const reason = [say('dropped', { items: [...dropped].map((key) => JSON.stringify(key)).join('; ') }), say('reason', { chars: String(DROP_REASON_CHARS) })].join(' ');
    return { decision: 'refused', yours, reason };
  }
  if (unknown !== null) return { decision: 'unchecked', yours, reason: `${unknown}, so what this write of board/summary takes from yours is not known; the call goes through unchecked` };
  return { decision: 'admitted', yours, reason: null };
}

const fresh = (line, now) => now - Date.parse(line.at) <= RENDERED_FRESH_HOURS * 3600 * 1000;

/** Every sentence the gate sends the model, with its slots as `<name>`: a refusal is these, filled, and nothing else.
 * They are the text source `template-gate` of directive coverage (bin/lib/rules-sources.mjs), each span declared in
 * the register, so a sentence changed or added here is a gap `rules check` names. */
export const GATE_SAYS = Object.freeze({
  refused: 'js-harness template gate: this page came from no template command (sha256 <sha> is not in <file>).',
  signed: 'It carries the signature of the template <id>, so it is that template\'s page made by hand.',
  open: 'The moment <subject> of the template <id> is open and shows no page yet.',
  make: 'Make it with its command and publish that file unchanged: <commands>.',
  none: 'no page template is registered yet',
  widget: 'A moment\'s page goes by Artifact with the file the command wrote, never retyped into a widget.',
  free: 'If no record holds what it shows, mark it free: <mark>.',
  asked: 'js-harness template gate: this question is not one of the record as its template makes it (<why>; the record is <file>).',
  ask: 'Record it with js-harness notify --to orchestrator --kind question, then ask it with the input js-harness template ask <n> prints, unchanged.',
  dropped: 'js-harness template gate: this write of board/summary takes from yours what it gives no reason for: <items>.',
  reason: 'Keep each in yours, or name it in the same write\'s yoursDropped: [{ item, reason }], a reason of <chars> characters or more; an item reworded leaves as the old one.',
  whole: 'js-harness template gate: a str_replace cannot change yours on board/summary; write it whole, with set or update and yoursDropped for what leaves.',
});

/** The sentences of `GATE_SAYS` as one text, a paragraph each, as the coverage cuts it. */
export const GATE_MESSAGES = `${Object.values(GATE_SAYS).join('\n\n')}\n`;

/** The sentence `key` of `GATE_SAYS` with each `<name>` slot filled from `values`. */
const say = (key, values = {}) => GATE_SAYS[key].replace(/<(\w+)>/g, (slot, name) => (Object.hasOwn(values, name) ? values[name] : slot));

/** The command line of each page template, for a refusal. */
function commandsOf(templates) {
  const pages = templates.filter((entry) => entry.surface === 'page');
  return pages.length === 0 ? say('none') : pages.map((entry) => `${entry.id}: ${entry.render}`).join('; ');
}

/** The escape list over the records (odd/tasks/templates.md, "Proof"): per template its rendered, admitted, shown,
 * refused and unchecked counts; each free page with its reason; each escape, a moment of `moments` (`[{ template,
 * subject }]`, the moments a record holds) with no `shown` line of its template and subject, and a `shown` line whose
 * rendered line names no moment; and how many calls went unchecked. `rendered` and `shown` are the records' lines
 * since the window opened. */
export function shownReport({ rendered, shown, moments }) {
  const templates = {};
  const count = (id, field) => {
    if (id === null || id === undefined) return;
    // An own key: `constructor` is a valid id, and an inherited one would take its count.
    if (!Object.hasOwn(templates, id)) templates[id] = { rendered: 0, admitted: 0, shown: 0, refused: 0, unchecked: 0 };
    templates[id][field] += 1;
  };
  for (const line of rendered) count(line.template, 'rendered');
  for (const line of shown) if (line.decision !== 'free') count(line.template, line.decision);
  const free = shown.filter((line) => line.decision === 'free').map((line) => ({ at: line.at, reason: line.reason }));
  const seen = (template, subject) => shown.some((line) => line.decision === 'shown' && line.template === template && line.subject === subject);
  const escapes = [
    ...moments.filter((moment) => !seen(moment.template, moment.subject)).map((moment) => `the moment ${moment.subject} of ${moment.template} was never shown`),
    ...shown.filter((line) => line.decision === 'shown' && line.template !== null && (typeof line.subject !== 'string' || line.subject === ''))
      .map((line) => `a page of ${line.template} shown at ${line.at} names no moment`),
  ];
  // A write of the board's summary the gate could not judge shows no page or question, so it is no call unchecked here.
  const unchecked = shown.filter((line) => line.decision === 'unchecked' && line.subject !== SUMMARY_SUBJECT).length;
  return { templates, free, escapes, unchecked };
}

/** The decision on one page, `{ decision, template, subject, sha256, reason }`: `admitted` when a fresh rendered line
 * holds its bytes (a widget, its normal text), `free` when it carries the free mark and neither proof of a moment
 * holds (a page template's signature in it, or a moment of a page template open), `refused` otherwise, with the text
 * that says what to run. `page` is `{ text }` for a file or `{ widget }` for a widget's code; `rendered` the lines of
 * the rendered record; `templates` the registry; `openMoments` `[{ template, subject }]`; `now` in milliseconds;
 * `renderedPath` the record's file, named in the refusal. */
export function decidePage({ page, rendered, templates, openMoments, now, renderedPath }) {
  const widget = typeof page.widget === 'string';
  const text = widget ? page.widget : page.text;
  // A file's hash is of its bytes, as `recordRendered` takes it: text decoded from bytes that are not UTF-8 differs.
  const hash = sha256(!widget && page.bytes !== undefined ? page.bytes : text);
  const normal = sha256(normalText(text));
  const match = rendered.findLast((line) => fresh(line, now) && (widget ? line.normal === normal : line.sha256 === hash));
  if (match) return { decision: 'admitted', template: match.template, subject: match.subject, sha256: hash, reason: null };
  const signed = templates.find((entry) => typeof entry.signature === 'string' && entry.signature !== '' && text.includes(entry.signature));
  const open = openMoments[0];
  const free = freeReason(text);
  if (free !== null && !signed && !open) return { decision: 'free', template: null, subject: null, sha256: hash, reason: free };
  const why = [say('refused', { sha: hash.slice(0, 12), file: renderedPath })];
  if (signed) why.push(say('signed', { id: signed.id }));
  if (open) why.push(say('open', { subject: open.subject, id: open.template }));
  why.push(say('make', { commands: commandsOf(templates) }));
  if (widget) why.push(say('widget'));
  if (!signed && !open) why.push(say('free', { mark: MARK_TEXT }));
  return { decision: 'refused', template: signed?.id ?? open?.template ?? null, subject: open?.subject ?? null, sha256: hash, reason: why.join(' ') };
}

/** What a call of `tool` with `input` asks the user: `{ asks }`, each question of a call of the question tool, or
 * `null` when the call asks nothing. */
export function askTarget(tool, input) {
  if (tool !== 'AskUserQuestion' || !Array.isArray(input?.questions)) return null;
  return { asks: input.questions };
}

/** The decision on one asked question, `{ decision, template, subject, sha256, reason }`: `admitted` when `admit`
 * holds it to an open question of the record as `render` makes it, `refused` otherwise with the text that says how to
 * ask it. `questions` the record's (`recordedQuestions`); `recordPath` the channel's record, named in the refusal. */
export function decideAsk({ asked, questions, recordPath }) {
  const { admitted, number, why } = admit({ asked, questions });
  const subject = number === null ? null : String(number);
  const hash = sha256(JSON.stringify(asked ?? null));
  if (admitted) return { decision: 'admitted', template: 'question', subject, sha256: hash, reason: null };
  const reason = [say('asked', { why, file: recordPath }), say('ask', subject === null ? {} : { n: subject })].join(' ');
  return { decision: 'refused', template: 'question', subject, sha256: hash, reason };
}
