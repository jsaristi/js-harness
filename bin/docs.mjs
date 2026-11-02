#!/usr/bin/env node
// `docs`: what an auditor starting cold reads (odd/tasks/audit-pack.md). `docs plan` prints the reading plan, every
// tracked file in a slice one context holds, the source beside its capability (bin/lib/docs-plan.mjs); `docs check`
// runs the `docs` row of `check` alone. The row holds the index of `docs/README.md` to the folder (bin/lib/docs-entry.mjs)
// and the plan to the tracked files, so neither can fall behind. It reads the files git tracks and writes nothing;
// the plan is computed each time, never stored. Zero dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { estimateTokens } from './lib/payload.mjs';
import { SPEC_PATH, isHarnessRepository, parseSpec } from './lib/spec.mjs';
import { SLICE_BUDGET, capabilityFiles, importsOf, planFindings, readingPlan } from './lib/docs-plan.mjs';
import { ENTRY_PATH, indexFindings } from './lib/docs-entry.mjs';
import { gitTopLevel } from './lib/project.mjs';
import { parseFeature } from './lib/progress.mjs';

export const USAGE = 'Usage: js-harness docs plan [--budget <n>] [--json] | docs check';

class DocsArgError extends Error {}

/** `n` with its thousands separated, as the plan prints its figures. */
const figure = (n) => n.toLocaleString('en-US');

/** `n` things, in the singular for one. */
const count = (n, noun, plural = `${noun}s`) => `${n} ${n === 1 ? noun : plural}`;

/** The files git tracks under `root`, from its index, so a file staged for the commit counts and an untracked one
 * does not; `null` when git cannot list them. */
function trackedFiles(root, spawn) {
  const listed = spawn('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
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
  for (const file of listed) {
    try {
      texts.set(file, readFile(path.join(root, file)));
    } catch (err) {
      // A file in the index and gone from the tree (deleted, not staged) is read as empty: it still has its slice.
      // Any other error is said, since a file read as empty would count no tokens and pass unseen.
      if (err.code !== 'ENOENT') unreadable.push(`${file} cannot be read: ${err.message}`);
      texts.set(file, '');
    }
  }
  const tracked = new Set(listed);
  const files = listed.map((file) => ({ path: file, tokens: estimateTokens(texts.get(file)), ...stateOf(file, texts.get(file)) }));
  const capabilities = tracked.has(SPEC_PATH) ? parseSpec(texts.get(SPEC_PATH)).capabilities.map((one) => capabilityFiles(one, tracked)) : [];
  const imports = Object.fromEntries(listed.filter((file) => /^bin\/.*\.[cm]?js$/.test(file)).map((file) => [file, importsOf(file, texts.get(file), tracked)]));
  return { listed, texts, files, capabilities, imports, unreadable };
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
 * a tracked file the reading plan does not place once (`planFindings`, a self-check of the packer). The repository
 * is the one `cwd` is in, read at its top. */
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
  const findings = [...corpus.unreadable, ...indexFindings(index, entries, corpus.listed), ...oversizedFindings(plan), ...planFindings(plan, corpus.files)];
  if (findings.length > 0) return [{ name, pass: false, detail: `${count(findings.length, 'finding')} in the index of ${ENTRY_PATH} or the reading plan`, lines: findings }];
  const detail = `${count(entries.length, 'entry', 'entries')} of docs/ indexed; ${figure(plan.files)} tracked files in ${count(sliceCount(plan), 'slice')} of at most ${figure(plan.budget)} estimated tokens (js-harness docs plan)`;
  return [{ name, pass: true, detail }];
}

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

/** Walks argv token by token: `plan` takes `--budget <n>` and `--json`; `check` takes nothing. */
function parseArgs(argv) {
  const [sub, ...rest] = argv;
  if (sub !== 'plan' && sub !== 'check') throw new DocsArgError(sub === undefined ? 'name a subcommand: plan or check' : `unknown argument: ${sub}`);
  const parsed = { sub, budget: SLICE_BUDGET, json: false };
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (sub === 'plan' && token === '--json') parsed.json = true;
    else if (sub === 'plan' && token === '--budget') {
      const value = rest[++i];
      if (!/^[1-9]\d*$/.test(value ?? '')) throw new DocsArgError(`--budget takes a whole number of estimated tokens, not ${value ?? 'nothing'}`);
      parsed.budget = Number(value);
    } else throw new DocsArgError(`unknown argument: ${token}`);
  }
  return parsed;
}

/** `js-harness docs plan` prints the reading plan of the repository `cwd` is in and exits 0; `docs check` runs the
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
  const plan = readingPlan({ files: corpus.files, capabilities: corpus.capabilities, imports: corpus.imports, budget: parsed.budget, preamble: ENTRY_PATH });
  if (parsed.json) stdout(JSON.stringify(plan, null, 2));
  else for (const line of renderPlan(plan)) stdout(line);
  if (corpus.unreadable.length === 0) return 0;
  stderr([...corpus.unreadable, 'the plan counts it as empty, so its figures are short'].join('\n'));
  return 1;
}
