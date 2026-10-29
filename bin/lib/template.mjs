// The registry of templates (odd/tasks/templates.md, "The registry"): the outputs that reach the user again and again,
// each held by five parts, a sample the user approved, the command that renders it, a golden test, a gate on the
// path to the user and a test that the gate refuses a hand-made one. The registry is data, `template-registry.mjs`,
// whose text is what `writeRegistry` gives, so `template new` and a person change it the same way. Pure: it reads
// no file; the command hands it texts.
import { createHash } from 'node:crypto';

/** The surfaces a template's gate sits on, each with the host tools its gate watches. `stop` is the reply's `Stop`
 * hook, which watches no tool; `command:<name>` is a command that refuses its own input. */
export const SURFACES = Object.freeze({
  page: Object.freeze(['Artifact', 'mcp__visualize__show_widget']),
  board: Object.freeze(['ArtifactData']),
  ask: Object.freeze(['AskUserQuestion']),
  stop: Object.freeze([]),
});

export const KINDS = Object.freeze(['rendered', 'shape']);

/** The surface `name` names, `{ name, tools }` (with `command` for `command:<name>`), or `null` when it is none. */
export function surfaceOf(name) {
  if (typeof name !== 'string') return null;
  if (name.startsWith('command:')) {
    const command = name.slice('command:'.length);
    return /^[a-z][a-z-]*$/.test(command) ? { name: 'command', command, tools: [] } : null;
  }
  return Object.hasOwn(SURFACES, name) ? { name, tools: [...SURFACES[name]] } : null;
}

const HEADER = `// The registry of templates (odd/tasks/templates.md, "The registry"): one entry an output that reaches the user
// again and again, with its five parts. This file is data and imports nothing. Its text is what \`writeRegistry\` of
// ./template.mjs gives for the list, and a test holds it to that: \`js-harness template new\` adds an entry, and a
// person changes one in the same shape.
`;
const DECLARATION = 'export const TEMPLATES = ';

/** The text of `template-registry.mjs` for `list`, sorted by id. */
export function writeRegistry(list) {
  const sorted = [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return `${HEADER}${DECLARATION}${JSON.stringify(sorted, null, 2)};\n`;
}

/** The list a text of `template-registry.mjs` declares, or `{ error }` when it is not in the shape `writeRegistry`
 * gives. */
export function registryOfText(text) {
  const start = text.indexOf(DECLARATION);
  const end = text.lastIndexOf(';');
  if (start === -1 || end < start) return { error: 'the registry is not in the shape writeRegistry gives' };
  try {
    const list = JSON.parse(text.slice(start + DECLARATION.length, end));
    return Array.isArray(list) ? list : { error: 'the registry declares no list' };
  } catch (err) {
    return { error: `the registry does not parse: ${err.message}` };
  }
}

/** The sha256 of `bytes` (a string or a buffer), in hex. */
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The digest a sample is pinned by: the sha256 of its bytes with each CRLF read as LF, so a checkout that turns line
 * ends to CRLF (core.autocrlf) holds the sample he approved. */
export const sampleDigest = (bytes) => sha256(Buffer.from(Buffer.from(bytes).toString('latin1').replace(/\r\n/g, '\n'), 'latin1'));
