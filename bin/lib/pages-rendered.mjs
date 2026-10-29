// The one call a page command makes once it has written its page (odd/tasks/visual-pages.md, T10): the page's bytes
// go into the rendered record of the templates (odd/tasks/templates.md, "The two records"), so the gate on the path to
// him admits that file unchanged and refuses a page drawn by hand. The record and its gate are JH 80's, in
// `bin/lib/template-record.mjs`; until that module is in the install the page is said unrecorded, never recorded here
// in another shape. `load` is the seam the tests stub.

import { fileURLToPath } from 'node:url';

/** The page templates of the rendered record's contract, by id. */
export const PAGE_TEMPLATES = ['stretch-departure', 'stretch-status', 'stretch-return', 'feature-close', 'phase-change', 'status-report'];

const RECORD_MODULE = new URL('./template-record.mjs', import.meta.url);

/** The record's module, or `null` when that module itself is not installed. A module that is there and fails to load,
 * one of its own imports missing among them, throws: a broken record is not an absent one. */
export async function loadRecordModule(load = (url) => import(url.href), url = RECORD_MODULE) {
  try {
    return await load(url);
  } catch (err) {
    // The module Node could not find: its `url`, else the first name of the message ("Cannot find module '<x>' imported
    // from <importer>"), never the importer, which is the record module itself when one of its imports is missing.
    const missing = err.url ? fileURLToPath(err.url) : /^Cannot find (?:module|package) '([^']+)'/.exec(String(err.message))?.[1];
    if (err.code === 'ERR_MODULE_NOT_FOUND' && missing === fileURLToPath(url)) return null;
    throw err;
  }
}

/** Records the page at `path`, as written, under `template` and `subject` (the moment's id as the page record names it:
 * the stretch's id, the feature document's path, `map`): `{ recorded, file }`, or `{ unavailable }` saying why
 * not. An id outside `PAGE_TEMPLATES` is a caller's error and throws. */
export async function recordPageRendered({ home, slug, template, subject, path, at, head }, { load = () => loadRecordModule() } = {}) {
  if (!PAGE_TEMPLATES.includes(template)) throw new Error(`unknown page template: ${template}`);
  const record = await load();
  if (record === null) return { unavailable: 'bin/lib/template-record.mjs is not in this install yet, so the page is not in the rendered record' };
  let file = null;
  try {
    file = record.renderedFile(home, slug);
    return { recorded: record.recordRendered(file, { template, subject, path, at, head }), file };
  } catch (err) {
    return { unavailable: `the rendered record ${file ?? `of ${slug}`} could not be written: ${err.code ?? err.message}` };
  }
}
