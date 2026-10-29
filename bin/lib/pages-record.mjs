// The record of the pages made at the harness's moments (odd/tasks/visual-pages.md): one JSON line a page, with its
// kind, its subject (a stretch's id, a feature document's path, `map`), the time, the commit of the default branch it
// read and its numbers, so the next page of that kind and subject compares with it. It sits beside the throughput
// days, under the harness home, which `uninstall` keeps and names. Append only.
import fs from 'node:fs';
import path from 'node:path';

export const PAGE_SCHEMA = 'js-harness.page/v1';

/** The page record's file for the project `slug` under `home`. */
export const pagesFile = (home, slug) => path.join(home, '.js-harness', 'throughput', slug, 'pages.jsonl');

/** The pages of `file`, oldest first; none when there is no file. A line that is no page is left out; a file that is
 * there and cannot be read throws. */
export function readPages(file, fileSystem = fs) {
  let text;
  try {
    text = fileSystem.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return text.split(/\r?\n/).flatMap((line) => {
    try {
      const page = JSON.parse(line);
      return page?.schema === PAGE_SCHEMA && typeof page.kind === 'string' ? [page] : [];
    } catch {
      return [];
    }
  });
}

/** The newest page of `kind` and `subject` among `pages`, or `null`. */
export const lastPage = (pages, kind, subject) => pages.findLast((page) => page.kind === kind && page.subject === subject) ?? null;

/** Appends `{ kind, subject, at, head, numbers }` unless the last page of its kind and subject read the same head:
 * `true` when it was appended. A line left without its newline is ended first, so the new page is whole. */
export function appendPage(file, { kind, subject, at, head, numbers }, fileSystem = fs) {
  const last = lastPage(readPages(file, fileSystem), kind, subject);
  if (last !== null && last.head === head) return false;
  fileSystem.mkdirSync(path.dirname(file), { recursive: true });
  let text = '';
  try {
    text = fileSystem.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const unterminated = text !== '' && !text.endsWith('\n');
  fileSystem.appendFileSync(file, `${unterminated ? '\n' : ''}${JSON.stringify({ schema: PAGE_SCHEMA, kind, subject, at, head, numbers })}\n`, 'utf8');
  return true;
}
