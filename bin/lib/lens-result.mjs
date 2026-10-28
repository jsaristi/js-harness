// Whether a lens's answer counts (odd/tasks/f8-s1-reviews.md, T2; diet section 10, "S1, the Claude lens runner",
// item 5). A result counts only when it is the shape the prompt asks for (`./lens-prompts.mjs`), echoes the
// candidate's subject hash, and reports a completed inspection of every path of the manifest. Anything else is
// incomplete: the run that gave it is recorded, and no review is.
import { SEVERITIES } from './lens-prompts.mjs';

const TOP = ['subject_hash', 'inspection', 'findings', 'evidence'];
const FINDING = ['location', 'severity', 'claim', 'evidence_class', 'causal_disposition', 'proof_refs'];
// A line that opens or closes a Markdown code fence: three backticks or three tildes (CommonMark's two kinds).
const FENCE = /^\s*(```|~~~)/;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const texts = (value) => Array.isArray(value) && value.every(isText);

/** Where the brace-delimited span that opens at `start` closes (the index past its last `}`), or -1 when it never
 * does. Braces inside a JSON string do not count. */
function spanEnd(text, start) {
  let depth = 0;
  let inString = false;
  for (let at = start; at < text.length; at += 1) {
    const char = text[at];
    if (inString) {
      if (char === '\\') at += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}' && (depth -= 1) === 0) return at + 1;
  }
  return -1;
}

/** Why the span `json` does not parse, with where it breaks and the text there when the parser names a position. */
function parseFault(json, offset, err) {
  const position = /at position (\d+)/.exec(err.message);
  if (!position) return `an object in it does not parse: ${err.message}`;
  const at = Number(position[1]);
  const near = json.slice(Math.max(0, at - 40), at + 40).replace(/\s+/g, ' ');
  return `an object in it does not parse at character ${offset + at}, near ${JSON.stringify(near)}`;
}

/** The one JSON object `text` holds, `{ value }`, or `{ why }` when it holds none, more than one, one that does not
 * parse, or Markdown fences other than one around the object. Prose before or after the object is not read: a lens
 * often adds a line, and the object alone is its result. Every brace-delimited span counts as a would-be object, so
 * an answer that offers two results, or a broken one beside a whole one, is never read as one complete result. */
function objectOf(text) {
  const objects = [];
  for (let start = text.indexOf('{'); start !== -1; ) {
    const end = spanEnd(text, start);
    if (end === -1) return { why: `an object in it is not closed (it opens at character ${start})` };
    const json = text.slice(start, end);
    let value;
    try {
      value = JSON.parse(json);
    } catch (err) {
      return { why: parseFault(json, start, err) };
    }
    objects.push({ value, start, end });
    start = text.indexOf('{', end);
  }
  if (objects.length !== 1) return { why: `it holds ${objects.length || 'none'}` };
  const [{ value, start, end }] = objects;
  const fences = (part) => part.split('\n').filter((line) => FENCE.test(line)).length;
  const [before, after] = [fences(text.slice(0, start)), fences(text.slice(end))];
  if (before + after !== 0 && (before !== 1 || after !== 1)) return { why: `its Markdown fences are not one block around the object (${before} before it, ${after} after)` };
  // An object that is an element of a JSON array is not the result the prompt asks for, so it is not read as one.
  const beside = (part) => part.split('\n').filter((line) => !FENCE.test(line)).join('\n').trim();
  if (/[[,]$/.test(beside(text.slice(0, start))) || /^[\],]/.test(beside(text.slice(end)))) return { why: 'its object is an element of a JSON array' };
  return { value };
}

/** Why the finding `finding` (at `at`) is not one, or `null`. */
function findingFault(finding, at) {
  if (!isObject(finding)) return `finding ${at} is not an object`;
  const unknown = Object.keys(finding).filter((key) => !FINDING.includes(key));
  if (unknown.length) return `finding ${at} has unknown fields: ${unknown.join(', ')}`;
  if (!SEVERITIES.includes(finding.severity)) return `finding ${at} has severity ${JSON.stringify(finding.severity)}, not one of ${SEVERITIES.join(', ')}`;
  for (const key of ['location', 'claim', 'evidence_class', 'causal_disposition']) {
    if (!isText(finding[key])) return `finding ${at} has no ${key}`;
  }
  if (!texts(finding.proof_refs) || finding.proof_refs.length === 0) return `finding ${at} has no proof_refs list`;
  return null;
}

/** What the lens answer `text` is worth for `candidate` (`{ subjectHash, manifest }`): `{ complete: true,
 * findings, evidence }`, or `{ complete: false, why }`. */
export function lensResult(text, candidate) {
  const incomplete = (why) => ({ complete: false, why });
  const read = typeof text === 'string' ? objectOf(text) : { why: 'it is no text' };
  if (read.why) return incomplete(`the answer is not one JSON object: ${read.why}`);
  const { value } = read;
  const unknown = Object.keys(value).filter((key) => !TOP.includes(key));
  if (unknown.length) return incomplete(`the answer has unknown fields: ${unknown.join(', ')}`);
  if (value.subject_hash !== candidate.subjectHash) return incomplete(`its subject_hash ${JSON.stringify(value.subject_hash)} is not the candidate's`);
  const inspection = value.inspection;
  if (!isObject(inspection) || inspection.status !== 'completed') return incomplete(`its inspection is ${isObject(inspection) ? JSON.stringify(inspection.status) : 'missing'}, not completed`);
  if (!texts(inspection.paths)) return incomplete('its inspection lists no paths');
  const listed = new Set(inspection.paths);
  if (listed.size !== inspection.paths.length) return incomplete('its inspection lists a path twice');
  const manifest = candidate.manifest.map((entry) => entry.path);
  const missing = manifest.filter((path) => !listed.has(path));
  if (missing.length) return incomplete(`its inspection leaves out ${missing.join(', ')}`);
  const extra = inspection.paths.filter((path) => !manifest.includes(path));
  if (extra.length) return incomplete(`its inspection lists paths the manifest does not hold: ${extra.join(', ')}`);
  if (!Array.isArray(value.findings)) return incomplete('its findings are not a list');
  for (const [at, finding] of value.findings.entries()) {
    const fault = findingFault(finding, at);
    if (fault) return incomplete(fault);
  }
  if (!texts(value.evidence) || value.evidence.length === 0) return incomplete('its evidence is not a list of what was inspected');
  return { complete: true, findings: value.findings, evidence: value.evidence };
}
