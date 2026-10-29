// The template gate's decisions (odd/tasks/templates.md, "The gates on the path to him"): what a host tool call is
// about to show the user, and whether a template command made it. This module holds the `page` surface (an `Artifact`
// publish of a page, an `mcp__visualize__show_widget`); `bin/template.mjs` reads the files and the records and writes
// the decision. Pure: it is handed the page's text, the rendered lines, the registry and the open moments.
import path from 'node:path';
import { normalText, sha256 } from './template.mjs';

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
    ...moments.filter((moment) => !seen(moment.template, moment.subject)).map((moment) => `the moment ${moment.subject} of ${moment.template} shows no page`),
    ...shown.filter((line) => line.decision === 'shown' && line.template !== null && (typeof line.subject !== 'string' || line.subject === ''))
      .map((line) => `a page of ${line.template} shown at ${line.at} names no moment`),
  ];
  const unchecked = shown.filter((line) => line.decision === 'unchecked').length;
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
