// The two records of the template gate (odd/tasks/templates.md, "The records"): what a template command rendered, and
// what the gate decided and the user was shown. Both sit beside the page record in the project's throughput folder
// under the harness home, which `uninstall` keeps. Append only: one append of the whole line after a line left without
// its newline is ended, as the channel record does, and a reader skips a line that does not parse, so a cut last line
// is never read as a record. `recordRendered` is the one line a page command adds once it has written its file (JH 79's
// page commands call it).
import fs from 'node:fs';
import path from 'node:path';
import { normalText, sha256 } from './template.mjs';

export { normalText, sha256 };

export const RENDERED_SCHEMA = 'js-harness.rendered/v1';
export const SHOWN_SCHEMA = 'js-harness.shown/v1';

/** What the gate decides before a call (`refused`, `admitted`, `free`, `unchecked`) and what it writes after one that
 * succeeded (`shown`). */
export const DECISIONS = Object.freeze(['refused', 'admitted', 'free', 'unchecked', 'shown']);

const throughput = (home, slug) => path.join(home, '.js-harness', 'throughput', slug);

/** The record of what template commands rendered for the project `slug` under `home`. */
export const renderedFile = (home, slug) => path.join(throughput(home, slug), 'templates-rendered.jsonl');

/** The record of what the gate decided and what was shown, for the project `slug` under `home`. */
export const shownFile = (home, slug) => path.join(throughput(home, slug), 'templates-shown.jsonl');

/** Appends `object` as one JSON line to `file`, ending first a line left without its newline. Throws when it cannot. */
export function appendRecord(file, object, fileSystem = fs) {
  fileSystem.mkdirSync(path.dirname(file), { recursive: true });
  let unterminated = false;
  try {
    const { size } = fileSystem.statSync(file);
    if (size > 0) {
      const last = Buffer.alloc(1);
      const fd = fileSystem.openSync(file, 'r');
      try {
        fileSystem.readSync(fd, last, 0, 1, size - 1);
      } finally {
        fileSystem.closeSync(fd);
      }
      unterminated = last[0] !== 0x0a;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  fileSystem.appendFileSync(file, `${unterminated ? '\n' : ''}${JSON.stringify(object)}\n`, 'utf8');
}

/** The lines of `file` whose `schema` is `schema`, oldest first; none when there is no file. A line that does not
 * parse is left out; a file that is there and cannot be read throws. */
export function readRecord(file, schema, fileSystem = fs) {
  let text;
  try {
    text = fileSystem.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return text.split(/\r?\n/).flatMap((line) => {
    try {
      const record = JSON.parse(line);
      return record?.schema === schema ? [record] : [];
    } catch {
      return [];
    }
  });
}

/** Records what a template command rendered: reads the bytes of `path` as they are on disk once the command has
 * written them and appends their sha256, the sha256 of their normal text, their size, the template's id, the moment's
 * `subject`, the time and the default branch's commit the page read. Returns the line. A file it cannot read or a
 * line it cannot write throws, so the page stays unpublishable rather than published unrecorded. */
export function recordRendered(file, { template, subject, path: page, at, head }, fileSystem = fs) {
  for (const [name, value] of Object.entries({ template, subject, path: page })) {
    if (typeof value !== 'string' || value === '') throw new Error(`recordRendered: ${name} is required`);
  }
  // The gate admits a page by the age of its line, so a line whose time does not parse could never admit it.
  if (typeof at !== 'string' || !Number.isFinite(Date.parse(at))) throw new Error(`recordRendered: at must be a time, not ${JSON.stringify(at)}`);
  const bytes = fileSystem.readFileSync(page);
  const line = {
    schema: RENDERED_SCHEMA, template, subject, sha256: sha256(bytes), normal: sha256(normalText(bytes.toString('utf8'))),
    bytes: bytes.length, at, head, path: page,
  };
  appendRecord(file, line, fileSystem);
  return line;
}

/** Records one decision of the gate, `{ at, session, tool, template, subject, decision, sha256, reason }`, and returns
 * the line. */
export function recordShown(file, { at, session, tool, template = null, subject = null, decision, sha256: hash = null, reason = null, call = null }, fileSystem = fs) {
  if (!DECISIONS.includes(decision)) throw new Error(`recordShown: the decision "${decision}" is none of ${DECISIONS.join(', ')}`);
  const line = { schema: SHOWN_SCHEMA, at, session, tool, call, template, subject, decision, sha256: hash, reason };
  appendRecord(file, line, fileSystem);
  return line;
}
