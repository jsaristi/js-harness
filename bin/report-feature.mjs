// `report feature <doc>`: the page of a feature's close (odd/tasks/visual-pages.md, "The feature's close"), made from
// the feature document, git and the records, never drawn by hand: what it promised and delivered, its pull requests,
// the time against its estimate, its reviews, its spend, the gates that failed in its folder and the map before and
// after it. Read-only but for `--html`, which writes the page and puts it in the rendered record of the templates,
// and `--record`, which keeps its numbers in the page record. Zero dependencies.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { homedir as osHomedir } from 'node:os';
import path from 'node:path';
import { readCodexReviews, readJsonLines } from './lib/codex-reviews.mjs';
import { readGateLog } from './lib/gate-log.mjs';
import { harnessHome } from './lib/home.mjs';
import { readLensReviews } from './lib/lens-reviews.mjs';
import { appendPage, pagesFile } from './lib/pages-record.mjs';
import { recordPageRendered } from './lib/pages-rendered.mjs';
import { estimateOf, featureFacts, featureNumbers, featureView, firstMergeOf, prsOf, renderFeature } from './lib/report-feature.mjs';
import { gitRead, momentAt, readRef } from './lib/report-git.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { gateRuns } from './lib/stretch.mjs';

export const FEATURE_USAGE = [
  'Usage: js-harness report feature <doc> [--branch <name>]... [--pr <n>]... [--html <file>] [--json] [--record] [--cwd <path>] [--home <path>]',
  '  The page of a feature\'s close: what its document promised (specs, done-when commands, tasks) and delivered, its',
  '  pull requests (the merges of the default branch from the branch its head line names, or a slice of it',
  '  <branch>-…, or --branch, or --pr), the time from its first commit to its last merge against the stretch',
  '  estimate of its session, the Codex and lens reviews and runs on its commits with their spend, the gates that',
  '  failed in its worktree (.claude/worktrees/<document name> of the main checkout, or a slice\'s <name>-…), and the',
  '  map before its first merge and after its last.',
  '  --html <file>  write the page there and put it in the rendered record of the templates, to show it unchanged',
  '  --json         print the view as JSON alone',
  '  --record       keep the page\'s numbers in the page record, under the document\'s path',
].join('\n');

class FeatureArgError extends Error {}

function parseArgs(argv) {
  const parsed = { json: false, record: false, branches: [], numbers: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--json' || token === '--record') {
      parsed[token.slice(2)] = true;
      continue;
    }
    if (!token.startsWith('--')) {
      if (parsed.doc !== undefined) throw new FeatureArgError(`one feature document only: ${token}`);
      parsed.doc = token;
      continue;
    }
    const key = { '--branch': 'branch', '--pr': 'pr', '--html': 'html', '--cwd': 'cwd', '--home': 'home' }[token];
    if (key === undefined) throw new FeatureArgError(`unknown argument: ${token}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--') || value === '') throw new FeatureArgError(`${token} requires a value`);
    i += 1;
    if (key === 'branch') parsed.branches.push(value);
    else if (key === 'pr') {
      if (!/^[1-9]\d*$/.test(value)) throw new FeatureArgError(`--pr takes a pull request number: ${value}`);
      parsed.numbers.push(Number(value));
    } else parsed[key] = value;
  }
  if (parsed.doc === undefined) throw new FeatureArgError('report feature needs the feature document: report feature odd/tasks/<feature>.md');
  return parsed;
}

const MERGE_LOG = ['log', '--first-parent', '--merges', '--format=%H%x1f%cI%x1f%s'];

/** The merges of `ref`'s first-parent line, `[{ hash, at, subject }]`, or `{ error }`. */
function mergesOf(run, cwd, ref) {
  const read = gitRead(run, cwd, [...MERGE_LOG, ref, '--']);
  if (read.error) return read;
  return read.stdout.split('\n').filter((line) => line.trim() !== '').map((line) => {
    const [hash, time, ...subject] = line.split('\u001f');
    return { hash, at: Date.parse(time), subject: subject.join('\u001f').trim() };
  });
}

/** The commits a merge brought, `[{ hash, at }]`, without the merges of the default branch into its branch. */
function commitsOf(run, cwd, hash) {
  const read = gitRead(run, cwd, ['log', '--no-merges', '--format=%H%x1f%cI', `${hash}^1..${hash}^2`, '--']);
  if (read.error) return read;
  return read.stdout.split('\n').filter((line) => line.trim() !== '').map((line) => {
    const [commit, time] = line.split('\u001f');
    return { hash: commit, at: Date.parse(time) };
  });
}

/** The stretch record's events, or `[]` when there is none; a line that is not JSON is skipped. */
function stretchEvents(home, slug, fileSystem) {
  let text;
  try {
    text = fileSystem.readFileSync(path.join(home, '.js-harness', 'throughput', slug, 'stretches.jsonl'), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return text.split(/\r?\n/).flatMap((line) => {
    try {
      const event = JSON.parse(line);
      return event && typeof event === 'object' ? [event] : [];
    } catch {
      return [];
    }
  });
}

const failedGate = (result) => typeof result === 'string' && result !== 'pass' && result !== 'exit 0';

export async function reportFeatureMain(argv, { cwd: defaultCwd = process.cwd(), stdout = console.log, stderr = console.error, now = () => Date.now(), env = process.env, run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true }), homedir = osHomedir, fileSystem = fs, recordLoad } = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof FeatureArgError)) throw err;
    stderr(`${err.message}\n\n${FEATURE_USAGE}`);
    return 2;
  }
  const cwd = path.resolve(defaultCwd, parsed.cwd ?? '.');
  const main = mainCheckout(run, cwd);
  const slug = projectSlug(main);
  const home = harnessHome({ given: parsed.home, env, cwd: defaultCwd, homedir });
  const at = new Date(now()).toISOString();
  const docFile = path.resolve(cwd, parsed.doc);
  const subject = path.relative(cwd, docFile).split(path.sep).join('/');

  let markdown;
  try {
    markdown = fileSystem.readFileSync(docFile, 'utf8');
  } catch (err) {
    stderr(`js-harness report feature: the feature document ${docFile} could not be read: ${err.code ?? err.message}`);
    return 1;
  }
  const facts = featureFacts(markdown);
  const fail = (what) => {
    stderr(`js-harness report feature: ${what}`);
    return 1;
  };

  const named = readRef(run, cwd);
  if (named.error) return fail(`the default branch could not be read: ${named.error}`);
  const merges = mergesOf(run, cwd, named.ref);
  if (merges.error) return fail(`the merges of ${named.ref} could not be read: ${merges.error}`);
  // The merges are matched first by their subjects alone; only the feature's are asked for their commits.
  const want = { branches: [...facts.branches, ...parsed.branches], numbers: parsed.numbers };
  const found = prsOf(merges, want);
  const theirs = new Set(found.unknown ? [] : found.flatMap((pr) => pr.merges));
  const withCommits = [];
  for (const merge of merges) {
    if (!theirs.has(merge.hash)) continue;
    const commits = commitsOf(run, cwd, merge.hash);
    if (commits.error) return fail(`the commits of ${merge.hash.slice(0, 8)} could not be read: ${commits.error}`);
    withCommits.push({ ...merge, commits });
  }
  const prs = found.unknown ? found : prsOf(withCommits, want);

  let events;
  try {
    events = stretchEvents(home, slug, fileSystem);
  } catch (err) {
    return fail(`the stretch record could not be read: ${err.code ?? err.message}`);
  }
  // The gates that failed in the feature's worktrees while it ran: the one the harness makes for it, named as its
  // document under the project's main checkout, and those of its slices (`<name>-…`), as its branches are matched.
  // The gate log is the machine's, so a folder of that name in another project is not the feature's; a log that
  // cannot be read is said, never shown as no failure.
  const commits = prs.unknown ? [] : prs.flatMap((pr) => pr.commits);
  const from = commits.length ? Math.min(...commits.map((commit) => commit.at)) : null;
  const to = prs.unknown ? null : Math.max(...prs.map((pr) => pr.at));
  const trees = path.join(main, '.claude', 'worktrees');
  const name = path.basename(docFile, '.md');
  const folder = path.join(trees, name);
  const fold = (text) => (process.platform === 'win32' ? text.toLowerCase() : text);
  const ofFeature = (cwd) => {
    const place = path.resolve(cwd);
    const base = fold(path.basename(place));
    return fold(path.dirname(place)) === fold(path.resolve(trees)) && (base === fold(name) || base.startsWith(fold(`${name}-`)));
  };
  let failures;
  if (from === null) failures = { folder, unavailable: 'its commits are not known, so neither is when it ran' };
  else {
    const log = readGateLog(home, { fileSystem });
    failures = log.unavailable
      ? { folder, unavailable: log.unavailable.join('; ') }
      : { folder, runs: gateRuns(log.events).filter((gate) => failedGate(gate.result) && Date.parse(gate.startedAt) >= from && Date.parse(gate.startedAt) <= to && typeof gate.cwd === 'string' && ofFeature(gate.cwd)) };
  }

  const first = firstMergeOf(prs);
  const last = prs.unknown ? null : prs.at(-1).merges.at(-1);
  const head = last ?? gitRead(run, cwd, ['rev-parse', '--verify', `${named.ref}^{commit}`]).stdout?.trim();
  if (!head) return fail(`${named.ref} could not be read`);
  const after = momentAt(run, cwd, head);
  if (after.unavailable) return fail(`the roadmap at ${head.slice(0, 8)} could not be read: ${after.unavailable}`);
  const before = first === null ? null : momentAt(run, cwd, `${first}^1`);
  const view = featureView({
    path: subject,
    facts,
    prs,
    codexReviews: readCodexReviews(cwd),
    codexRuns: readJsonLines(cwd, 'codex-review-runs.jsonl'),
    lensReviews: readLensReviews(cwd),
    estimate: estimateOf(events, facts.session),
    failures,
    before,
    after,
  });

  const say = parsed.json ? stderr : stdout;
  if (parsed.html) {
    const file = path.resolve(cwd, parsed.html);
    try {
      fileSystem.mkdirSync(path.dirname(file), { recursive: true });
      fileSystem.writeFileSync(file, renderFeature(view), 'utf8');
    } catch (err) {
      return fail(`the page ${file} could not be written: ${err.code ?? err.message}`);
    }
    const rendered = await recordPageRendered({ home, slug, template: 'feature-close', subject, path: file, at, head }, recordLoad ? { load: recordLoad } : {});
    say(rendered.recorded ? `Wrote ${file}, in the rendered record ${rendered.file} (sha256 ${rendered.recorded.sha256.slice(0, 12)}): show or publish it unchanged.` : `Wrote ${file}; it is not in the rendered record: ${rendered.unavailable}.`);
  }
  if (parsed.json) stdout(JSON.stringify(view, null, 2));
  else {
    stdout(`${subject}: ${view.promised.tasks.done}/${view.promised.tasks.total} tasks; ${prs.unknown ? `pull requests unknown (${prs.unknown})` : prs.map((pr) => `PR ${pr.number}`).join(', ')}.`);
    stdout(`Time ${view.time.realHours ?? '?'} h real, estimate ${view.time.estimate ? view.time.estimate.hours.join('-') + ' h' : 'none recorded'}; ${view.reviews.covered}/${view.reviews.commits} commits end a Codex review; ${failures.unavailable ? `failed gates unknown (${failures.unavailable})` : `${failures.runs.length} failed gates`}.`);
  }
  if (!parsed.record) return 0;
  try {
    appendPage(pagesFile(home, slug), { kind: 'feature', subject, at, head, numbers: featureNumbers(view) }, fileSystem);
  } catch (err) {
    return fail(`the page record could not be written: ${err.code ?? err.message}`);
  }
  return 0;
}
