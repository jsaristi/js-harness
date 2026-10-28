// `js-harness rules coverage` in a project (F8 S5c-a, `odd/tasks/f8-s5c-a-coverage.md`, S7; the reverse-engineering
// document, section 14.3): each span of a text `init` wrote is bound to the harness's proof while the project keeps
// the harness's words (its hash is a span of that text as this copy renders it), and is on the project's side once
// the project edits it or adds to it; and the project's own rules, each with the control `docs/rules.json` names,
// which `rules check` asks of every live rule once the manifest records the project's baseline. The project keeps no
// register of its own yet, so its side is reported, never refused, and dating it at the edit waits for one.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FAILURES_TEMPLATE, agentsTemplate, claudeTemplate } from './project.mjs';
import { coverageRecord, readProjectRules } from './project-rules-read.mjs';
import { proveBreaks } from './rules-coverage-read.mjs';
import { cutSpans, spanWords } from './rules-coverage.mjs';
import { PROJECT_RULES_PATH } from './project-rules.mjs';

/** The texts `init` writes into the project `name`, by the path it writes each to: AGENTS.md split or whole. */
const initTexts = (name) => [
  { path: 'AGENTS.md', texts: [agentsTemplate(name), agentsTemplate(name, { split: false })] },
  { path: 'CLAUDE.md', texts: [claudeTemplate()] },
  { path: 'docs/FAILURES.md', texts: [FAILURES_TEMPLATE] },
];

/** The coverage of the texts init wrote into the project `name`: `record` its manifest's (`{ baseline, release }` or
 * `null`), `version` this copy's, `readFile(path)` a file of the project or `null`. Each file is `{ path, present,
 * bound, own }`: `bound` counts its spans that are the harness's text, and `own` lists the rest. */
export function projectCoverage({ record, version, name, readFile }) {
  const files = initTexts(name).map(({ path, texts }) => {
    const text = readFile(path);
    if (text === null) return { path, present: false, bound: 0, own: [] };
    const shipped = new Set(texts.flatMap((item) => cutSpans(item).map((span) => span.id)));
    const spans = cutSpans(text);
    return { path, present: true, bound: spans.filter((span) => shipped.has(span.id)).length, own: spans.filter((span) => !shipped.has(span.id)) };
  });
  return { record, release: { recorded: record?.release ?? null, running: version }, files };
}

/** The `coverage` form of `js-harness rules` in the project at `top`: the report, `--json`, `--strict` (exit 1 on
 * a finding of the project's rules, a missing control among them) and `--prove` (each check of a project rule turns
 * its test red in a copy). `--refresh` is refused: a project keeps no register. `version` is this copy's. */
export function projectCoverageForm(parsed, top, { run, stdout, stderr, version }) {
  if (parsed.refresh) {
    stderr(`rules coverage --refresh writes the harness's register, and a project keeps none: its side is reported, and its rules' controls are in ${PROJECT_RULES_PATH}`);
    return 1;
  }
  let record;
  let read;
  try {
    record = coverageRecord(top, run);
    read = readProjectRules(top, { sensors: null, run });
  } catch (err) {
    stderr(err.message);
    return 1;
  }
  const rules = read.present && read.readable ? read.rules.filter((rule) => !Object.hasOwn(rule, 'retired')) : [];
  const findings = read.present ? read.findings : [];
  const name = top.split(/[\\/]/).filter(Boolean).at(-1);
  const report = projectCoverage({ record, version, name, readFile: (file) => readText(top, file) });
  const controls = Object.fromEntries(rules.filter((rule) => Object.hasOwn(rule, 'control')).map((rule) => [rule.id, rule.control]));
  const proofs = parsed.prove ? proveBreaks(top, { controls }, { spawn: run, tmpdir: os.tmpdir() }) : null;
  const open = proofs === null ? 0 : proofs.filter((proof) => !proof.red).length;
  const failed = open > 0 || (parsed.strict && findings.length > 0);
  // With `--json` the output is the one document, the proofs in it, so that it parses.
  if (parsed.json) {
    stdout(JSON.stringify({ ...report, rules: rules.map((rule) => ({ id: rule.id, control: rule.control ?? null })), findings, ...(proofs === null ? {} : { proofs }) }, null, 2));
    return failed ? 1 : 0;
  }
  if (proofs !== null) {
    for (const proof of proofs) stdout(`${proof.red ? 'PROVEN ' : 'FAIL   '} ${proof.rule}: ${proof.test} with the break in ${proof.path} ${proof.red ? 'went red' : 'stayed green'}`);
    stdout(open === 0 ? `PASS  prove  ${proofs.length} planted ${proofs.length === 1 ? 'break' : 'breaks'} of this project's rules turn their tests red` : `FAIL  prove  ${open} of ${proofs.length} planted breaks left their test green`);
    if (open > 0) return 1;
  }
  if (record === null) stdout(`This project records no coverage baseline: \`js-harness init\` records it when it sets a project up, and until then no rule of ${PROJECT_RULES_PATH} needs a control.`);
  else stdout(`Directive coverage of this project, from its baseline of ${record.baseline} (set by js-harness ${record.release}; this is ${version}):`);
  for (const file of report.files) {
    if (!file.present) {
      stdout(`  ${file.path}: not in this project`);
      continue;
    }
    stdout(`  ${file.path}: ${file.bound} spans bound to the harness's proof, ${file.own.length} on the project's side`);
    for (const span of file.own) stdout(`    ${span.id}: "${spanWords(span)}"`);
  }
  stdout(`  rules: ${rules.length} live in ${PROJECT_RULES_PATH}, ${Object.keys(controls).length} naming a control`);
  if (record !== null && record.release !== version) stdout(`note: the baseline was set by js-harness ${record.release} and this is ${version}: the spans are read against this copy's texts`);
  const failing = parsed.strict ? findings : [];
  const word = parsed.strict ? 'strict' : 'coverage';
  stdout(failing.length === 0 ? `PASS  ${word}  the project's rules hold${parsed.strict ? ', each with its control from the baseline' : ''}` : `FAIL  ${word}  ${failing.length} ${failing.length === 1 ? 'finding' : 'findings'}`);
  for (const line of failing) stdout(`      ${line}`);
  if (!parsed.strict) for (const line of findings) stdout(`note: ${line}`);
  return failed ? 1 : 0;
}

/** The text of `file` under `top`, or `null` when it is not there. */
function readText(top, file) {
  try {
    return fs.readFileSync(path.join(top, ...file.split('/')), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR' || err.code === 'EISDIR') return null;
    throw err;
  }
}
