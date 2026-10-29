// `report phase`: the page of a phase's change (odd/tasks/visual-pages.md, "The phase's change"), made from the
// records, never drawn by hand: the whole map at the default branch now against the commit the last phase page read
// (or `--since`), the phases that closed, each plan step by step and what is next. Read-only but for `--html`, which
// writes the page and puts it in the rendered record of the templates, and `--record`, which keeps its numbers in the
// page record so the next phase page compares with them. Zero dependencies.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { homedir as osHomedir } from 'node:os';
import path from 'node:path';
import { harnessHome } from './lib/home.mjs';
import { appendPage, lastPage, pagesFile, readPages } from './lib/pages-record.mjs';
import { recordPageRendered } from './lib/pages-rendered.mjs';
import { gitRead, momentAt, readRef } from './lib/report-git.mjs';
import { phaseNumbers, phaseView, renderPhase } from './lib/report-phase.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';

export const PHASE_USAGE = [
  'Usage: js-harness report phase [--since <commit>] [--html <file>] [--json] [--record] [--cwd <path>] [--home <path>]',
  '  The page of a phase change: the whole roadmap map at the default branch now, each phase before and now, the',
  '  phases that closed, each plan step by step and what is next (the first step not done, the open phases).',
  '  The before is the commit the last phase page recorded read, else --since; with neither the page says so.',
  '  --html <file>  write the page there and put it in the rendered record of the templates, to show it unchanged',
  '  --json         print the view as JSON alone',
  '  --record       keep the page\'s numbers in the page record, so the next phase page compares with this one',
].join('\n');

class PhaseArgError extends Error {}

function parseArgs(argv) {
  const parsed = { json: false, record: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--json' || token === '--record') {
      parsed[token.slice(2)] = true;
      continue;
    }
    const key = { '--since': 'since', '--html': 'html', '--cwd': 'cwd', '--home': 'home' }[token];
    if (key === undefined) throw new PhaseArgError(`unknown argument: ${token}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--') || value === '') throw new PhaseArgError(`${token} requires a value`);
    parsed[key] = value;
    i += 1;
  }
  return parsed;
}

export async function reportPhaseMain(argv, { cwd: defaultCwd = process.cwd(), stdout = console.log, stderr = console.error, now = () => Date.now(), env = process.env, run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true }), homedir = osHomedir, fileSystem = fs, recordLoad } = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof PhaseArgError)) throw err;
    stderr(`${err.message}\n\n${PHASE_USAGE}`);
    return 2;
  }
  const cwd = path.resolve(defaultCwd, parsed.cwd ?? '.');
  const slug = projectSlug(mainCheckout(run, cwd));
  const home = harnessHome({ given: parsed.home, env, cwd: defaultCwd, homedir });
  const at = new Date(now()).toISOString();

  const named = readRef(run, cwd);
  const seen = named.error ? named : gitRead(run, cwd, ['rev-parse', '--verify', `${named.ref}^{commit}`]);
  const after = seen.error ? { unavailable: seen.error } : momentAt(run, cwd, seen.stdout.trim());
  if (after.unavailable) {
    stderr(`js-harness report phase: the roadmap at the default branch could not be read: ${after.unavailable}`);
    return 1;
  }
  const record = pagesFile(home, slug);
  let last;
  try {
    last = lastPage(readPages(record, fileSystem), 'phase', 'map');
  } catch (err) {
    stderr(`js-harness report phase: the page record ${record} could not be read: ${err.code ?? err.message}`);
    return 1;
  }
  const beforeCommit = parsed.since ?? last?.head ?? null;
  const before = beforeCommit === null ? null : momentAt(run, cwd, beforeCommit);
  const view = phaseView({ before, after, since: parsed.since ?? (last ? 'record' : null) });

  // The line the rendered record gives goes where it does not break the JSON a reader parses.
  const say = parsed.json ? stderr : stdout;
  if (parsed.html) {
    const file = path.resolve(cwd, parsed.html);
    fileSystem.mkdirSync(path.dirname(file), { recursive: true });
    fileSystem.writeFileSync(file, renderPhase(view), 'utf8');
    const rendered = await recordPageRendered({ home, slug, template: 'phase-change', subject: 'map', path: file, at, head: after.commit }, recordLoad ? { load: recordLoad } : {});
    say(rendered.recorded ? `Wrote ${file}, in the rendered record ${rendered.file} (sha256 ${rendered.recorded.sha256.slice(0, 12)}): show or publish it unchanged.` : `Wrote ${file}; it is not in the rendered record: ${rendered.unavailable}.`);
  }
  if (parsed.json) stdout(JSON.stringify(view, null, 2));
  else {
    stdout(`Map now ${view.map.total.after.done}/${view.map.total.after.total} at ${after.commit.slice(0, 8)}; before: ${view.head.before === null ? 'none' : view.head.before.slice(0, 8)}${view.unavailable.before ? ` (${view.unavailable.before})` : ''}.`);
    stdout(`Closed: ${view.closed.join(', ') || 'none'}. Next: ${view.next.step ? `${view.next.step.id} (${view.next.step.plan})` : 'no step left'}; ${view.next.open.length} open phases.`);
  }
  if (!parsed.record) return 0;
  try {
    appendPage(record, { kind: 'phase', subject: 'map', at, head: after.commit, numbers: phaseNumbers(view) }, fileSystem);
  } catch (err) {
    stderr(`js-harness report phase: the page record ${record} could not be written: ${err.code ?? err.message}`);
    return 1;
  }
  return 0;
}
