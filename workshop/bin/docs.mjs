#!/usr/bin/env node
// `docs`: what an auditor starting cold reads (odd/tasks/audit-pack.md). `docs plan` prints the reading plan, every
// tracked file in a slice one context holds, the source beside its capability (workshop/lib/docs-plan.mjs); `docs check`
// runs the `docs` row of `check` alone. The row holds the index of `docs/README.md` to the folder (workshop/lib/docs-entry.mjs)
// and the plan to the tracked files, so neither can fall behind. It reads the files git tracks and writes nothing;
// the plan is computed each time, never stored. Zero dependencies.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { estimateTokens } from '../../bin/lib/payload.mjs';
import { SPEC_PATH, isHarnessRepository, parseSpec } from '../../bin/lib/spec.mjs';
import { SLICE_BUDGET, capabilityFiles, importsOf, planFindings, readingPlan } from '../lib/docs-plan.mjs';
import { ENTRY_PATH, indexFindings } from '../lib/docs-entry.mjs';
import { INFERRED_CHECK, INFERRED_LABEL, crossIndex, parseRules } from '../lib/docs-cross.mjs';
import { detectRecordNames, parseRecordSections, parseRecordTable, recordFindings, recordSources } from '../lib/docs-records.mjs';
import { parseRegister } from '../../bin/lib/failures.mjs';
import { gitTopLevel } from '../../bin/lib/project.mjs';
import { parseFeature } from '../../bin/lib/progress.mjs';

export const USAGE = 'Usage: js-harness docs plan [--budget <n>] [--json] | docs index [--json] | docs check';

class DocsArgError extends Error {}

/** `n` with its thousands separated, as the plan prints its figures. */
const figure = (n) => n.toLocaleString('en-US');

/** `n` things, in the singular for one. */
const count = (n, noun, plural = `${noun}s`) => `${n} ${n === 1 ? noun : plural}`;

/** The files git tracks under `root`, from its index, so a file staged for the commit counts and an untracked one
 * does not; `null` when git cannot list them. A tree with no `.git`, as the gate's WSL mirror is synced
 * (bin/lib/gate-wsl.mjs), has no index: there the files are those on disk git would not ignore (`filesGitKeeps`). */
function trackedFiles(root, spawn) {
  if (!fs.existsSync(path.join(root, '.git'))) return filesGitKeeps(root, spawn);
  return listedBy(spawn('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
}

/** The files on disk under `root` that its `.gitignore` files do not ignore, listed by git from a scratch repository
 * outside the tree, so nothing is written into it and an ignored log or eval run is not read as a source; `null` when
 * git cannot list them. */
function filesGitKeeps(root, spawn) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-docs-'));
  try {
    const made = spawn('git', ['init', '-q', scratch], { encoding: 'utf8' });
    if (!made || made.error || made.status !== 0) return null;
    const args = [`--git-dir=${path.join(scratch, '.git')}`, `--work-tree=${root}`, 'ls-files', '--others', '--exclude-standard', '-z'];
    return listedBy(spawn('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

/** The paths of a `git ls-files -z` that ran, or `null` when it did not. */
function listedBy(listed) {
  if (!listed || listed.error || listed.status !== 0) return null;
  return listed.stdout.split('\0').filter((file) => file !== '');
}

/** The state of a feature document of `odd/tasks/`, from its task boxes as `js-harness progress` counts them (`{ state }`),
 * computed each time rather than stored as a status; nothing for any other file. */
function stateOf(file, text) {
  if (!/^odd\/tasks\/[^/]+\.md$/.test(file)) return {};
  const { done, total } = parseFeature(text, path.posix.basename(file, '.md'));
  if (total === 0) return { state: 'no tasks' };
  return { state: `${done === total ? 'closed' : 'open'}, ${done} of ${total} tasks` };
}

/** What the plan and the row are made from, read under `root`: the tracked files with their estimated tokens and
 * texts, the capabilities of the specification, and the imports of the source. `null` when git cannot list the files. */
function readCorpus(root, { spawn, readFile }) {
  const listed = trackedFiles(root, spawn);
  if (listed === null) return null;
  const texts = new Map();
  const unreadable = [];
  const gone = new Set(); // tracked files deleted from the tree, read as empty
  for (const file of listed) {
    try {
      texts.set(file, readFile(path.join(root, file)));
    } catch (err) {
      // A file in the index and gone from the tree (deleted, not staged) is read as empty: it still has its slice.
      // Any other error is said, since a file read as empty would count no tokens and pass unseen.
      if (err.code === 'ENOENT') gone.add(file);
      else unreadable.push(`${file} cannot be read: ${err.message}`);
      texts.set(file, '');
    }
  }
  const tracked = new Set(listed);
  const files = listed.map((file) => ({ path: file, tokens: estimateTokens(texts.get(file)), ...stateOf(file, texts.get(file)) }));
  const capabilities = tracked.has(SPEC_PATH) ? parseSpec(texts.get(SPEC_PATH)).capabilities.map((one) => capabilityFiles(one, tracked)) : [];
  const imports = Object.fromEntries(listed.filter((file) => /^bin\/.*\.[cm]?js$/.test(file)).map((file) => [file, importsOf(file, texts.get(file), tracked)]));
  return { listed, texts, files, capabilities, imports, unreadable, gone };
}

const RULES_PATH = 'docs/RULES.md';
const FAILURES_PATH = 'docs/FAILURES.md';

/** The cross index of the corpus (workshop/lib/docs-cross.mjs), from the specification, the rendered rules and the failure
 * register, as `{ index }`; `{ problem }` where one of them is not tracked or the register does not read. */
function readCross(corpus) {
  const tracked = new Set(corpus.listed);
  const missing = [SPEC_PATH, RULES_PATH, FAILURES_PATH].find((file) => !tracked.has(file));
  if (missing) return { problem: `${missing} is not tracked: the cross index joins ${SPEC_PATH}, ${RULES_PATH} and ${FAILURES_PATH}` };
  const gone = [SPEC_PATH, RULES_PATH, FAILURES_PATH].find((file) => corpus.gone.has(file));
  if (gone) return { problem: `${gone} is gone from the tree: the cross index joins ${SPEC_PATH}, ${RULES_PATH} and ${FAILURES_PATH}` };
  const register = parseRegister(corpus.texts.get(FAILURES_PATH));
  if (register.errors.length > 0) return { problem: `${FAILURES_PATH} does not read as a register (${register.errors[0]}): js-harness failures check names each fault` };
  const index = crossIndex({
    capabilities: parseSpec(corpus.texts.get(SPEC_PATH)).capabilities,
    rules: parseRules(corpus.texts.get(RULES_PATH)),
    failures: register.entries.map((entry) => ({ id: entry.id, control: entry.control?.path ?? null })),
    tracked,
    texts: corpus.texts,
  });
  return { index };
}

const RECORDS_PATH = 'docs/RECORDS.md';

/** The table of records of the specification held to the source and to the fields of docs/RECORDS.md
 * (workshop/lib/docs-records.mjs): `{ rows, findings }`, the rows counted. A file missing reads as empty, so a row then
 * has no section and the part fails rather than switching off. */
function readRecords(corpus) {
  const rows = parseRecordTable(corpus.texts.get(SPEC_PATH) ?? '');
  const sources = recordSources(corpus.listed, (file) => corpus.texts.get(file) ?? '');
  const findings = recordFindings({ rows, sections: parseRecordSections(corpus.texts.get(RECORDS_PATH) ?? ''), detected: detectRecordNames(sources), sources });
  return { rows: rows.length, findings };
}

const inferredCount = (index) => index.capabilities.reduce((sum, one) => sum + one.inferred.rules.length + one.inferred.failures.length, 0);
const unreachedCount = (index) => index.unreached.rules.length + index.unreached.failures.length + index.unreached.features.length;

/** The lines of `docs index`: the counts, each capability with its links, the files too shared to infer from, what no
 * capability reaches and the explicit links that do not resolve. */
function renderCross(index) {
  const all = index.capabilities;
  const having = (test) => all.filter(test).length;
  const lines = [
    `Cross index of ${count(all.length, 'capability', 'capabilities')}: ${having((one) => one.explicit.documents.length > 0)} cites a document, ${having((one) => one.explicit.rules.length > 0)} name a rule, ${having((one) => one.explicit.failures.length > 0)} a failure entry; ${having((one) => one.inferred.rules.length > 0)} reaches a rule and ${having((one) => one.inferred.failures.length > 0)} a failure entry by inference`,
    `Explicit links are what a capability's text cites; an ${INFERRED_LABEL} link comes from a file its Today or Proof line shares with a rule or a failure's control. --json gives the index whole.`,
  ];
  for (const one of all) {
    lines.push('', `${one.title} (line ${one.line})`);
    const { documents, rules, failures } = one.explicit;
    if (documents.length > 0) lines.push(`  cites: ${documents.join(', ')}`);
    if (rules.length > 0) lines.push(`  rules: ${rules.join(', ')}`);
    if (failures.length > 0) lines.push(`  failure entries: ${failures.join(', ')}`);
    const inferred = [...one.inferred.rules.map((link) => `rule ${link.id} through ${link.via}`), ...one.inferred.failures.map((link) => `failure ${link.id} through ${link.via}`)];
    if (inferred.length > 0) lines.push(`  ${INFERRED_LABEL}: ${inferred.join('; ')}`);
    if (documents.length + rules.length + failures.length + inferred.length === 0) lines.push('  no link, explicit or inferred');
  }
  if (index.shared.length > 0) {
    lines.push('', 'Too shared to infer from:');
    for (const one of index.shared) lines.push(`  ${one.file}: ${count(one.rules, 'rule')}, ${count(one.todays, 'Today line')}`);
  }
  const { rules, failures, features } = index.unreached;
  lines.push('', 'Reached by no capability:');
  lines.push(`  rules: ${rules.map((rule) => (rule.shared ? `${rule.id} (homed in ${rule.shared}, too shared)` : rule.id)).join(', ') || 'none'}`);
  lines.push(`  failure entries: ${failures.join(', ') || 'none'}`);
  lines.push(`  feature documents: ${features.join(', ') || 'none'}`);
  if (index.broken.length > 0) lines.push('', 'Explicit links that do not resolve:', ...index.broken.map((line) => `  ${line}`));
  return lines;
}

/** The files and folders directly under `docs/` among the tracked `files`, a folder written with its closing `/`. */
function docsEntries(files) {
  const entries = new Set();
  for (const file of files) {
    const parts = file.split('/');
    if (parts[0] !== 'docs' || parts.length < 2) continue;
    entries.add(parts.length === 2 ? file : `docs/${parts[1]}/`);
  }
  return [...entries].sort();
}

/** The finding of each slice that is one file over the budget: no context holds it whole, so the row fails until the
 * file is split. */
const oversizedFindings = (plan) => plan.tiers.flatMap((tier) => tier.slices.filter((slice) => slice.oversized).map((slice) => {
  const [one] = slice.groups[0].files;
  return `${one.path} alone is ${figure(one.tokens)} estimated tokens, over a slice of ${figure(plan.budget)} with its opening: split the file`;
}));

const sliceCount = (plan) => plan.tiers.reduce((sum, tier) => sum + tier.slices.length, 0);

/** The `docs` row of `check`, as a list: empty but in the harness's own repository (`own`, by default
 * `isHarnessRepository`), since a project's `docs/README.md` holds no index of this kind. It fails where
 * `docs/README.md` is missing, so deleting it cannot switch the row off; on an entry of `docs/` the index lacks or a
 * row it should not hold (`indexFindings`); on a tracked file it cannot read; on a file too big for one slice; and on
 * a tracked file the reading plan does not place once (`planFindings`, a self-check of the packer); on a record that
 * drifts from the source or has no fields (`readRecords`); and on an explicit
 * link of the cross index that does not resolve, or on one of its inputs gone or unreadable as a register, so deleting
 * one cannot switch that part off; its inferred links and unreached records it only counts. The repository is the one
 * `cwd` is in, read at its top. */
export function checkDocs(cwd, { spawn = spawnSync, readFile = (file) => fs.readFileSync(file, 'utf8'), own } = {}) {
  const root = path.resolve(gitTopLevel(cwd, spawn) ?? cwd);
  if (!(own ?? isHarnessRepository(root))) return [];
  const name = 'docs';
  if (!fs.existsSync(path.join(root, ENTRY_PATH))) return [{ name, pass: false, detail: `${ENTRY_PATH} is missing: it is the entry of a cold audit, and the row holds its index to docs/` }];
  const corpus = readCorpus(root, { spawn, readFile });
  if (corpus === null) return [{ name, pass: false, detail: 'git cannot list the tracked files, so the index and the reading plan cannot be checked' }];
  const entries = docsEntries(corpus.listed);
  const plan = readingPlan({ files: corpus.files, capabilities: corpus.capabilities, imports: corpus.imports, preamble: ENTRY_PATH });
  const index = corpus.texts.get(ENTRY_PATH) ?? readFile(path.join(root, ENTRY_PATH));
  const cross = readCross(corpus);
  const crossFindings = cross.index?.broken ?? [cross.problem];
  const records = readRecords(corpus);
  const findings = [...corpus.unreadable, ...indexFindings(index, entries, corpus.listed), ...oversizedFindings(plan), ...planFindings(plan, corpus.files), ...records.findings, ...crossFindings];
  if (findings.length > 0) return [{ name, pass: false, detail: `${count(findings.length, 'finding')} in the index of ${ENTRY_PATH}, the reading plan, the records or the cross index`, lines: findings }];
  const detail = `${count(entries.length, 'entry', 'entries')} of docs/ indexed; ${figure(plan.files)} tracked files in ${count(sliceCount(plan), 'slice')} of at most ${figure(plan.budget)} estimated tokens (js-harness docs plan); ${count(records.rows, 'record')} of ${SPEC_PATH} held to the source and to ${RECORDS_PATH}${crossDetail(cross.index)}`;
  return [{ name, pass: true, detail }];
}

/** What the row says of the cross index when it passes: its inferred links and its unreached records, counted. */
const crossDetail = (index) => (index === undefined ? '' : `; every explicit link of the cross index resolves, ${count(inferredCount(index), 'link')} inferred, ${unreachedCount(index)} reached by no capability (js-harness docs index)`);

/** The lines of `docs plan`: the totals, then each tier and its slices, each group of a slice with its files. */
function renderPlan(plan) {
  const lines = [
    `Reading plan of ${figure(plan.files)} tracked files, ${figure(plan.tokens)} estimated tokens (characters over four), in ${count(sliceCount(plan), 'slice')} of at most ${figure(plan.budget)}`,
    'Read the tiers in order, one slice a context: the core first, then the tests, the feature documents and the rest. --json gives the plan whole.',
  ];
  for (const tier of plan.tiers) {
    lines.push('', `${tier.name}: ${count(tier.slices.length, 'slice')}, ${figure(tier.tokens)} estimated tokens`);
    for (const slice of tier.slices) {
      const opening = slice.opensWith ? `, opening with ${slice.opensWith}` : '';
      lines.push(`  slice ${slice.number}, ${figure(slice.tokens)} tokens${opening}${slice.oversized ? ', one file over the budget: read it in parts' : ''}`);
      for (const one of slice.groups) lines.push(`    ${one.name} (${figure(one.tokens)}): ${one.files.map((file) => (file.state ? `${file.path} (${file.state})` : file.path)).join(', ')}`);
    }
  }
  return lines;
}

/** The row as the gate prints it, for `docs check`. */
function formatRow(row) {
  const lines = (row.lines ?? []).map((line) => `\n      ${line}`).join('');
  return `${row.pass ? 'PASS' : 'FAIL'}  ${row.name}  ${row.detail}${lines}`;
}

/** Walks argv token by token: `plan` takes `--budget <n>` and `--json`, `index` takes `--json`; `check` takes nothing. */
function parseArgs(argv) {
  const [sub, ...rest] = argv;
  if (!['plan', 'index', 'check'].includes(sub)) throw new DocsArgError(sub === undefined ? 'name a subcommand: plan, index or check' : `unknown argument: ${sub}`);
  const parsed = { sub, budget: SLICE_BUDGET, json: false };
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (sub !== 'check' && token === '--json') parsed.json = true;
    else if (sub === 'plan' && token === '--budget') {
      const value = rest[++i];
      if (!/^[1-9]\d*$/.test(value ?? '')) throw new DocsArgError(`--budget takes a whole number of estimated tokens, not ${value ?? 'nothing'}`);
      parsed.budget = Number(value);
    } else throw new DocsArgError(`unknown argument: ${token}`);
  }
  return parsed;
}

/** `js-harness docs plan` prints the reading plan of the repository `cwd` is in and exits 0; `docs index` prints its
 * cross index and exits 0, or 1 where an explicit link does not resolve or an input is missing; `docs check` runs the
 * `docs` row alone and exits 1 when it fails. Exit 1 too where git cannot list the files, and from `plan` where a
 * tracked file cannot be read, after the plan; 2, with the usage on stderr, for an argument it does not know. */
export async function docsMain(argv, { cwd = process.cwd(), stdout = console.log, stderr = console.error, spawn = spawnSync, readFile = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof DocsArgError)) throw err;
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  if (parsed.sub === 'check') {
    const [row] = checkDocs(cwd, { spawn, readFile });
    if (row === undefined) {
      stdout(`not the harness's own repository: its ${ENTRY_PATH} is held to nothing`);
      return 0;
    }
    stdout(formatRow(row));
    return row.pass ? 0 : 1;
  }
  const root = path.resolve(gitTopLevel(cwd, spawn) ?? cwd);
  const corpus = readCorpus(root, { spawn, readFile });
  if (corpus === null) {
    stderr(`git cannot list the tracked files of ${root}: the reading plan is made from them`);
    return 1;
  }
  if (parsed.sub === 'index') {
    // An unreadable file is named first, since an input of the index read as empty is what makes it fail.
    if (corpus.unreadable.length > 0) stderr([...corpus.unreadable, 'the index reads it as empty, so a link through it may be missing'].join('\n'));
    const cross = readCross(corpus);
    if (cross.problem) {
      stderr(cross.problem);
      return 1;
    }
    if (parsed.json) stdout(JSON.stringify({ ...cross.index, inferredLinks: { label: INFERRED_LABEL, check: INFERRED_CHECK } }, null, 2));
    else for (const line of renderCross(cross.index)) stdout(line);
    return cross.index.broken.length === 0 && corpus.unreadable.length === 0 ? 0 : 1;
  }
  const plan = readingPlan({ files: corpus.files, capabilities: corpus.capabilities, imports: corpus.imports, budget: parsed.budget, preamble: ENTRY_PATH });
  if (parsed.json) stdout(JSON.stringify(plan, null, 2));
  else for (const line of renderPlan(plan)) stdout(line);
  if (corpus.unreadable.length === 0) return 0;
  stderr([...corpus.unreadable, 'the plan counts it as empty, so its figures are short'].join('\n'));
  return 1;
}
