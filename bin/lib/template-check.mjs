// `template check` (odd/tasks/templates.md, "js-harness template"): every registered template has its five parts on
// disk and wired, so none lands half done. It reads the files the command hands it and runs nothing: whether a golden
// test passes for the right reason is the reviews' to see, and the tests themselves run in every gate. Pure: the
// files come through `readFile`.
import { createHash } from 'node:crypto';
import { KINDS, surfaceOf } from './template.mjs';

/** The fields an entry must hold, by dotted path, in the order a fault names them. */
const REQUIRED = ['plantilla.what', 'plantilla.when', 'plantilla.looks', 'plantilla.where', 'sample.path', 'sample.sha256', 'sample.source',
  'render', 'module', 'exports.render', 'exports.admit', 'tests.file', 'tests.golden', 'tests.refusal'];

export const SCAFFOLD_BODY = 'not built yet';

const valueAt = (entry, dotted) => dotted.split('.').reduce((value, key) => (value !== null && typeof value === 'object' ? value[key] : undefined), entry);
const textOf = (content) => (Buffer.isBuffer(content) ? content.toString('utf8') : content);

/** Whether `source`, a module's text, exports `name`: a function, a const or a name in an export list. */
function exportsName(source, name) {
  const word = name.replace(/[$]/g, '\\$');
  if (new RegExp(`^export\\s+(?:async\\s+)?(?:function\\*?|const|let|class)\\s+${word}\\b`, 'm').test(source)) return true;
  return [...source.matchAll(/^export\s*\{([^}]*)\}/gm)].some((match) => match[1].split(',').map((part) => part.trim().split(/\s+as\s+/).pop()).includes(name));
}

/** The faults of one entry that reads its own files. */
function faultsOfEntry(entry, readFile, hooked) {
  const missing = REQUIRED.find((dotted) => {
    const value = valueAt(entry, dotted);
    return typeof value !== 'string' || value.trim() === '';
  });
  if (missing) return [`the entry lacks ${missing}`];
  if (!KINDS.includes(entry.kind)) return [`its kind "${entry.kind}" is neither rendered nor shape`];
  const surface = surfaceOf(entry.surface);
  if (surface === null) return [`its surface "${entry.surface}" is none of page, board, ask, stop or command:<name>`];
  const faults = [];
  if (entry.draft !== false) faults.push('a draft (template new wrote it): finish its renderer, its gate and its tests, then set draft to false');
  const sample = readFile(entry.sample.path);
  if (sample === null) faults.push(`${entry.sample.path}, its sample, is not there`);
  else if (createHash('sha256').update(sample).digest('hex') !== entry.sample.sha256) {
    faults.push(`${entry.sample.path} is not the sample he approved: its sha256 differs from sample.sha256; a new sample needs a new digest and his words in sample.source`);
  }
  if (entry.kind === 'rendered') {
    if (typeof entry.records !== 'string' || entry.records === '') faults.push('the entry lacks records, the input its golden test renders');
    else if (readFile(entry.records) === null) faults.push(`${entry.records}, its records, is not there`);
  }
  const module = readFile(entry.module);
  if (module === null) faults.push(`${entry.module}, its renderer, is not there`);
  else {
    const source = textOf(module);
    for (const name of [entry.exports.render, entry.exports.admit]) {
      if (!exportsName(source, name)) faults.push(`${entry.module} exports no ${name}`);
    }
    if (source.includes(SCAFFOLD_BODY)) faults.push(`${entry.module} still holds the scaffold body ("${SCAFFOLD_BODY}")`);
  }
  const tests = readFile(entry.tests.file);
  if (tests === null) faults.push(`${entry.tests.file}, its tests, is not there`);
  else {
    const source = textOf(tests);
    for (const title of [entry.tests.golden, entry.tests.refusal]) {
      const declaration = declarationOf(source, title);
      if (declaration === null) faults.push(`${entry.tests.file} has no test titled "${title}"`);
      else if (/^(?:test|it)\s*\.\s*(?:skip|todo)\b|\b(?:skip|todo)\s*:(?!\s*false\b)/.test(declaration)) faults.push(`${entry.tests.file} skips its test "${title}"`);
    }
  }
  const unwatched = surface.tools.filter((tool) => !hooked.has(tool));
  if (unwatched.length > 0) faults.push(`no installed hook watches ${unwatched.join(', ')}, the tool${unwatched.length > 1 ? 's' : ''} of its surface ${surface.name}`);
  return faults;
}

/** The declaration of the test titled `title` in `source`, from its `test` or `it` call to its body (the first `=>`
 * or `function` after the title), over as many lines as it takes; `null` when no quoted title is there. A
 * `test.skip(` before the title and a `{ skip: … }` after it are both inside it. */
function declarationOf(source, title) {
  const at = Math.max(...['\'', '"', '`'].map((quote) => source.indexOf(`${quote}${title}${quote}`)));
  if (at < 0) return null;
  const opener = [...source.slice(0, at).matchAll(/\b(?:test|it)\s*(?:\.\s*\w+\s*)?\(/g)].at(-1);
  const rest = source.slice(at + title.length + 2);
  const body = rest.search(/=>|\bfunction\b/);
  return source.slice(opener?.index ?? at, at + title.length + 2 + (body < 0 ? 0 : body));
}

/** The faults of `entries`, each `{ id, fault }`, in the registry's order; none when every template is whole.
 * `readFile(rel)` gives a file's content (a string or bytes) or `null` when it is not there; `hooked` is the set of
 * tools the installed gate hook watches. */
export function checkTemplates(entries, { readFile, hooked }) {
  const faults = [];
  const ids = new Set();
  const signatures = new Map();
  for (const entry of entries) {
    const id = typeof entry?.id === 'string' && entry.id !== '' ? entry.id : '(no id)';
    if (ids.has(id)) {
      faults.push({ id, fault: 'the id is registered twice' });
      continue;
    }
    ids.add(id);
    for (const fault of faultsOfEntry(entry, readFile, hooked)) faults.push({ id, fault });
    if (typeof entry.signature === 'string' && entry.signature !== '') {
      if (signatures.has(entry.signature)) faults.push({ id, fault: `its signature is also template ${signatures.get(entry.signature)}'s` });
      else signatures.set(entry.signature, id);
    }
  }
  return faults;
}
