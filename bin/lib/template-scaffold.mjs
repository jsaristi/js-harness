// `template new`, the template of templates (odd/tasks/templates.md, spec 5): from the user's line `Plantilla: qué
// quiero ver · cuándo aparece · cómo se ve (la muestra que apruebo) · dónde me llega`, the five parts as files and a
// draft entry. The renderer and the gate throw until they are written, and their tests fail until then, so a template
// lands only whole. Pure: the command reads the sample and writes the files.
import { KINDS, sampleDigest, surfaceOf } from './template.mjs';
import { SCAFFOLD_BODY } from './template-check.mjs';

/** The fields of `template new`, in the order of the user's line, then the words that approved the sample. `ask` is
 * what the lead asks the user, alone, when the field is missing. */
export const FIELDS = Object.freeze([
  { key: 'what', flag: '--what', ask: 'qué quiero ver' },
  { key: 'when', flag: '--when', ask: 'cuándo aparece' },
  { key: 'sample', flag: '--sample', ask: 'cómo se ve: la muestra que apruebas, como archivo' },
  { key: 'where', flag: '--where', ask: 'dónde te llega' },
  { key: 'source', flag: '--source', ask: 'tus palabras que aprueban la muestra (transcript:línea)' },
]);

/** The first field of `given` that is missing or blank, or `null`. */
export function firstMissing(given) {
  return FIELDS.find(({ key }) => typeof given[key] !== 'string' || given[key].trim() === '') ?? null;
}

const ID = /^[a-z][a-z0-9-]{1,40}$/;

function moduleText(id, plantilla) {
  return `// Template \`${id}\` (odd/tasks/templates.md): ${plantilla.what}.
// Plantilla: ${plantilla.what} · ${plantilla.when} · ${plantilla.looks} · ${plantilla.where}.
// \`render\` makes it from the records; \`admit\` is what its gate asks before it reaches the user.

export function render() {
  throw new Error('template ${id}: ${SCAFFOLD_BODY}');
}

export function admit() {
  throw new Error('template ${id}: ${SCAFFOLD_BODY}');
}
`;
}

// The generated test reads its sample; the specifier is built so this module's own imports stay pure.
const NODE_FS = ['node', 'fs'].join(':');

function testText(id, sample, records) {
  const input = records ? `JSON.parse(fs.readFileSync(new URL('../../${records}', import.meta.url), 'utf8'))` : 'undefined';
  return `// The golden and refusal tests of template \`${id}\` (odd/tasks/templates.md). Both fail until render and admit are
// written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from '${NODE_FS}';
import { admit, render } from './template-${id}.mjs';

// Read as LF, as its digest is, so a checkout with CRLF holds the same sample.
const SAMPLE = fs.readFileSync(new URL('../../${sample}', import.meta.url), 'utf8').replace(/\\r\\n/g, '\\n');

test('template:${id} golden', () => {
  assert.equal(render(${input}), SAMPLE);
});

test('template:${id} refuses a hand-made one', () => {
  assert.equal(admit({ output: \`\${SAMPLE} hand-made\` }).admitted, false);
});
`;
}

/** The files and the draft entry of a new template, `{ files: [{ path, content }], entry }`, or `{ error }`. `given`
 * holds the fields, the id, and optionally `kind` (rendered when not given) and `surface` (page when not given);
 * `sampleBytes` are the sample's bytes, which the entry pins by their sha256. */
export function scaffold(given, sampleBytes) {
  const { id, kind = 'rendered', surface = 'page' } = given;
  if (typeof id !== 'string' || !ID.test(id)) return { error: `the id "${id}" must be lowercase letters, digits and dashes, 2 to 41 of them, starting with a letter` };
  if (!KINDS.includes(kind)) return { error: `the kind "${kind}" is neither rendered nor shape` };
  if (surfaceOf(surface) === null) return { error: `the surface "${surface}" is none of page, board, ask, stop or command:<name>` };
  const missing = firstMissing(given);
  if (missing) return { error: `missing ${missing.flag}: ${missing.ask}` };
  const extension = /\.([A-Za-z0-9]{1,8})$/.exec(given.sample)?.[1]?.toLowerCase() ?? 'txt';
  const sample = `templates/${id}/sample.${extension}`;
  const records = kind === 'rendered' ? `templates/${id}/records.json` : undefined;
  const module = `bin/lib/template-${id}.mjs`;
  const testFile = `bin/lib/template-${id}.test.mjs`;
  // One line each: the module names them in a `//` comment, which a newline would end.
  const line = (text) => text.replace(/\s+/g, ' ').trim();
  const plantilla = { what: line(given.what), when: line(given.when), looks: sample, where: line(given.where) };
  const entry = {
    id,
    kind,
    surface,
    plantilla,
    sample: { path: sample, sha256: sampleDigest(sampleBytes), source: given.source.trim() },
    ...(records ? { records } : {}),
    render: `<the command that renders ${id}>`,
    module,
    exports: { render: 'render', admit: 'admit' },
    tests: { file: testFile, golden: `template:${id} golden`, refusal: `template:${id} refuses a hand-made one` },
    draft: true,
  };
  const files = [
    { path: sample, content: sampleBytes },
    ...(records ? [{ path: records, content: '{}\n' }] : []),
    { path: module, content: moduleText(id, plantilla) },
    { path: testFile, content: testText(id, sample, records) },
  ];
  return { files, entry };
}
