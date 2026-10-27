// Whether a lens's answer counts (odd/tasks/f8-s1-reviews.md, T2; diet section 10, "S1, the Claude lens runner",
// item 5). A result counts only when it is the shape the prompt asks for (`./lens-prompts.mjs`), echoes the
// candidate's subject hash, and reports a completed inspection of every path of the manifest. Anything else is
// incomplete: the run that gave it is recorded, and no review is.
import { SEVERITIES } from './lens-prompts.mjs';

const TOP = ['subject_hash', 'inspection', 'findings', 'evidence'];
const FINDING = ['location', 'severity', 'claim', 'evidence_class', 'causal_disposition', 'proof_refs'];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const texts = (value) => Array.isArray(value) && value.every(isText);

/** The JSON object `text` holds, alone or inside one Markdown code fence; `null` for anything else. */
function objectOf(text) {
  const fenced = /^\s*```(?:json)?\s*\n([\s\S]*?)\n\s*```\s*$/.exec(text);
  try {
    const value = JSON.parse(fenced ? fenced[1] : text);
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
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
  const value = typeof text === 'string' ? objectOf(text) : null;
  if (!value) return incomplete('the answer is not one JSON object');
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
