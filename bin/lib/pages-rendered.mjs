// The one call a page command makes once it has written its page (odd/tasks/visual-pages.md, T10): the page's bytes
// go into the rendered record of the templates (odd/tasks/templates.md, "The two records"), so the gate on the path to
// him admits that file unchanged and refuses a page drawn by hand. The record and its gate are JH 80's, in
// `bin/lib/template-record.mjs`; until that module is in the install the page is said unrecorded, never recorded here
// in another shape. `load` is the seam the tests stub.

/** The page templates of the rendered record's contract, by id. */
export const PAGE_TEMPLATES = ['stretch-departure', 'stretch-status', 'stretch-return', 'feature-close', 'phase-change', 'status-report'];

const loadRecord = async () => {
  try {
    return await import('./template-record.mjs');
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') return null;
    throw err;
  }
};

/** Records the page at `path`, as written, under `template`: `{ recorded, file }`, or `{ unavailable }` saying why
 * not. An id outside `PAGE_TEMPLATES` is a caller's error and throws. */
export async function recordPageRendered({ home, slug, template, path, at, head }, { load = loadRecord } = {}) {
  if (!PAGE_TEMPLATES.includes(template)) throw new Error(`unknown page template: ${template}`);
  const record = await load();
  if (record === null) return { unavailable: 'bin/lib/template-record.mjs is not in this install yet, so the page is not in the rendered record' };
  const file = record.renderedFile(home, slug);
  try {
    return { recorded: record.recordRendered(file, { template, path, at, head }), file };
  } catch (err) {
    return { unavailable: `the rendered record ${file} could not be written: ${err.code ?? err.message}` };
  }
}
