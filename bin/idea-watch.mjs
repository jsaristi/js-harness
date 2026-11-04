// `js-harness idea-watch`: the idea watch's commands (odd/tasks/idea-watch.md; the reverse-engineering document's
// section 5). `status` says how many stable releases of the upstream repository the record has not read yet; `draft`
// fetches the upstream repository into a bare clone under ~/.js-harness, recorded in the machine manifest first so
// `uninstall machine` removes it, and prints the record's entry for the next release, its changed paths placed by
// area. Nothing is installed, built or run from the clone: it is bare, and only git reads it. The placing and the
// record's reading are bin/lib/idea-watch.mjs; this file fetches, reads and prints.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { harnessHome } from './lib/home.mjs';
import { RECORD, UPSTREAM, draftRelease, parseNumstat, stableVersions, unreadLine, watchState } from './lib/idea-watch.mjs';
import { recordClone } from './lib/clones.mjs';
import { resolveProjectRoot } from './lib/stack.mjs';
import { compareSemver } from './lib/version.mjs';

export const USAGE = [
  'Usage: js-harness idea-watch status [--project <dir>] [--home <path>]',
  '       js-harness idea-watch draft [--from <version>] [--to <version>] [--project <dir>] [--home <path>]',
  '',
  'status lists the stable tags of the upstream repository (git ls-remote, nothing fetched) and prints how many',
  `releases are above the last one ${RECORD} holds as read under "## Releases read", and which.`,
  '',
  'draft prints the record\'s entry for one release: the paths it changed against the last read, placed by area, one',
  'row an area with its verdict to give, and the paths no area matches under "To classify by hand"; a release whose',
  'paths all fall in ignored areas is one line. --from defaults to the last read, --to to the oldest release above it.',
  'It keeps a bare clone in ~/.js-harness/upstream, recorded in the machine manifest before it is fetched, so',
  'js-harness uninstall machine removes it; it is never built or run. Paste the entry into the record and decide it:',
  'a section still holding a "?" verdict or a path to classify does not count as read.',
  '',
  'Exit 0 when it printed, 1 when the record, the network or git failed, 2 for a usage error.',
].join('\n');

class IdeaWatchArgError extends Error {}

const VALUED = { status: ['--project', '--home'], draft: ['--from', '--to', '--project', '--home'] };
const VERSION = /^v?(\d+\.\d+\.\d+)$/;

function parseArgs(argv) {
  const [verb, ...rest] = argv;
  if (!Object.hasOwn(VALUED, verb ?? '')) throw new IdeaWatchArgError(verb === undefined ? 'a subcommand is required: status or draft' : `unknown argument: ${verb}`);
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!VALUED[verb].includes(token)) throw new IdeaWatchArgError(`unknown argument: ${token}`);
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) throw new IdeaWatchArgError(`${token} requires a value`);
    if (flags[token] !== undefined) throw new IdeaWatchArgError(`${token} is given twice`);
    flags[token] = value;
    i += 1;
  }
  for (const flag of ['--from', '--to']) {
    if (flags[flag] === undefined) continue;
    const version = VERSION.exec(flags[flag])?.[1];
    if (!version) throw new IdeaWatchArgError(`${flag} takes a version such as 4.3.1, not ${flags[flag]}`);
    flags[flag] = version;
  }
  return { verb, flags };
}

/** The watch's state from the record of the project and the tags upstream lists, or `{ error }`. */
function readState(ctx) {
  const file = path.join(ctx.project, RECORD);
  let record;
  try {
    record = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return { error: `no record of releases read: ${file} could not be read (${err.code ?? err.message})` };
  }
  const listed = ctx.git(['ls-remote', '--tags', UPSTREAM]);
  if (listed.status !== 0) return { error: `could not list the tags of ${UPSTREAM}: ${String(listed.stderr || listed.error?.message || '').trim()}` };
  return { ...watchState({ tags: listed.stdout, record }), versions: stableVersions(listed.stdout) };
}

/** What doctor's `idea-watch` row reads in `project`: `{ last, unread }`, `null` where the project keeps no record,
 * and a throw when the tags or the record cannot be read. The tags are listed with a 10 s bound, so a slow network
 * delays the interactive report by that much at most. */
export function ideaWatchHealth(project, deps = {}) {
  if (!fs.existsSync(path.join(project, RECORD))) return null;
  const env = deps.env ?? process.env;
  const state = readState({ project, git: deps.git ?? ((args) => runGit(args, env, 10_000)) });
  if (state.error) throw new Error(state.error);
  return { last: state.last, unread: state.unread };
}

/** Records the clone, then fetches it: cloned bare when it is not there, its tags fetched when it is. */
function fetchClone(ctx) {
  recordClone(ctx.home, { path: ctx.clone, url: UPSTREAM });
  const there = fs.existsSync(ctx.clone);
  const result = there
    ? ctx.git(['-C', ctx.clone, 'fetch', '--quiet', '--tags', '--force', UPSTREAM])
    : ctx.git(['clone', '--bare', '--quiet', UPSTREAM, ctx.clone]);
  if (result.status === 0) return null;
  return `could not ${there ? 'fetch' : 'clone'} ${UPSTREAM} into ${ctx.clone}: ${String(result.stderr || result.error?.message || '').trim()}`;
}

function draft(ctx, flags) {
  const state = readState(ctx);
  if (state.error) {
    ctx.stderr(`js-harness idea-watch: ${state.error}`);
    return 1;
  }
  const from = flags['--from'] ?? state.last;
  if (from === null) {
    ctx.stderr('js-harness idea-watch: the record holds no release read yet: give the first one with --from');
    return 1;
  }
  // The oldest stable release above `from`, which --from may set below the last read.
  const to = flags['--to'] ?? state.versions.find((version) => compareSemver(version, from) > 0) ?? null;
  if (to === null) {
    ctx.stdout(`nothing to read: no stable release above v${from}`);
    return 0;
  }
  if (compareSemver(to, from) <= 0) {
    ctx.stdout(`nothing to read: v${to} is not above v${from}`);
    return 0;
  }
  const failed = fetchClone(ctx);
  if (failed) {
    ctx.stderr(`js-harness idea-watch: ${failed}; the clone stays recorded, so js-harness uninstall machine removes what it left`);
    return 1;
  }
  const diff = ctx.git(['-C', ctx.clone, 'diff', '--numstat', '-z', '--no-renames', `v${from}`, `v${to}`]);
  if (diff.status !== 0) {
    ctx.stderr(`js-harness idea-watch: could not diff v${from} and v${to}: ${String(diff.stderr || diff.error?.message || '').trim()}`);
    return 1;
  }
  ctx.stdout(draftRelease({ from, to, changes: parseNumstat(diff.stdout), date: ctx.now().toISOString().slice(0, 10) }));
  return 0;
}

function status(ctx) {
  const state = readState(ctx);
  if (state.error) {
    ctx.stderr(`js-harness idea-watch: ${state.error}`);
    return 1;
  }
  ctx.stdout(unreadLine(state));
  return 0;
}

/** git as the watch runs it: never asking for credentials, the repository being public. */
function runGit(args, env, timeout = undefined) {
  return spawnSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...env, GIT_TERMINAL_PROMPT: '0' }, windowsHide: true, timeout });
}

export async function ideaWatchMain(argv = [], deps = {}) {
  const stdout = deps.stdout ?? console.log;
  const stderr = deps.stderr ?? console.error;
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof IdeaWatchArgError)) throw err;
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const env = deps.env ?? process.env;
  const cwd = deps.cwd ?? process.cwd();
  const home = harnessHome({ given: parsed.flags['--home'], env, cwd });
  const ctx = {
    stdout,
    stderr,
    home,
    clone: path.join(home, '.js-harness', 'upstream', 'gentle-ai'),
    project: parsed.flags['--project'] ? path.resolve(cwd, parsed.flags['--project']) : resolveProjectRoot(cwd),
    git: deps.git ?? ((args) => runGit(args, env)),
    now: deps.now ?? (() => new Date()),
  };
  return parsed.verb === 'draft' ? draft(ctx, parsed.flags) : status(ctx);
}
