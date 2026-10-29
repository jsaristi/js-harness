// The template gate's decisions (odd/tasks/templates.md, "The gates on the path to him"): what a host tool call is
// about to show the user, and whether a template command made it. This module holds the `page` surface (an `Artifact`
// publish of a page, an `mcp__visualize__show_widget`); `bin/template.mjs` reads the files and the records and writes
// the decision. Pure: it is handed the page's text, the rendered lines, the registry and the open moments.
import { normalText, sha256 } from './template.mjs';

/** How old a rendered line may be and still admit its page: an old page published again as a new moment's is refused. */
export const RENDERED_FRESH_HOURS = 6;

/** The shortest reason a free page gives. */
export const FREE_REASON_CHARS = 20;

const FREE_MARK = /<meta\s+name\s*=\s*["']js-harness-page["']\s+content\s*=\s*["']free:\s*([^"']*)["']\s*\/?>/i;
const MARK_TEXT = '<meta name="js-harness-page" content="free: <why, 20 characters or more>">';

/** The reason of a page's free mark, or `null` when it has none or its reason is under `FREE_REASON_CHARS`. */
export function freeReason(text) {
  const reason = FREE_MARK.exec(text)?.[1]?.trim();
  return reason !== undefined && reason.length >= FREE_REASON_CHARS ? reason : null;
}

const isPage = (file) => typeof file === 'string' && /\.(?:html?|md)$/i.test(file);

/** What a call of `tool` with `input` shows as a page: `{ files }`, the local files an `Artifact` publish sends as
 * pages (the page itself and each `.html` or `.md` of its `files`), or `{ widget }`, a widget's code; `null` when the
 * call shows no page (a read, an open, a list, a quickstart, an asset upload, a create from a type, a data file). */
export function pageTarget(tool, input) {
  if (tool === 'mcp__visualize__show_widget') return typeof input?.widget_code === 'string' ? { widget: input.widget_code } : null;
  if (tool !== 'Artifact' || input === null || typeof input !== 'object') return null;
  if ((input.action ?? 'publish') !== 'publish' || input.asset === true) return null;
  const files = [];
  if (isPage(input.file_path)) files.push(input.file_path);
  if (input.files !== null && typeof input.files === 'object' && !Array.isArray(input.files)) {
    for (const source of Object.values(input.files)) {
      const file = typeof source === 'string' ? source : source?.from;
      if (isPage(file)) files.push(file);
    }
  }
  return files.length > 0 ? { files } : null;
}

const fresh = (line, now) => now - Date.parse(line.at) <= RENDERED_FRESH_HOURS * 3600 * 1000;

/** The command line of each page template, for a refusal. */
function commandsOf(templates) {
  const pages = templates.filter((entry) => entry.surface === 'page');
  return pages.length === 0 ? 'no page template is registered yet' : pages.map((entry) => `${entry.id}: ${entry.render}`).join('; ');
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
  const hash = sha256(text);
  const normal = sha256(normalText(text));
  const match = rendered.findLast((line) => fresh(line, now) && (widget ? line.normal === normal : line.sha256 === hash));
  if (match) return { decision: 'admitted', template: match.template, subject: match.subject, sha256: hash, reason: null };
  const signed = templates.find((entry) => typeof entry.signature === 'string' && entry.signature !== '' && text.includes(entry.signature));
  const open = openMoments[0];
  const free = freeReason(text);
  if (free !== null && !signed && !open) return { decision: 'free', template: null, subject: null, sha256: hash, reason: free };
  const why = [`js-harness template gate: this page came from no template command (sha256 ${hash.slice(0, 12)} is not in ${renderedPath}).`];
  if (signed) why.push(`It carries the signature of the template ${signed.id}, so it is that template's page made by hand.`);
  if (open) why.push(`The moment ${open.subject} of the template ${open.template} is open and shows no page yet.`);
  why.push(`Make it with its command and publish that file unchanged: ${commandsOf(templates)}.`);
  if (widget) why.push('A moment\'s page goes by Artifact with the file the command wrote, never retyped into a widget.');
  if (!signed && !open) why.push(`If no record holds what it shows, mark it free: ${MARK_TEXT}.`);
  return { decision: 'refused', template: signed?.id ?? open?.template ?? null, subject: open?.subject ?? null, sha256: hash, reason: why.join(' ') };
}
