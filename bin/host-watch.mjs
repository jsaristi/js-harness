// `js-harness host-watch`: the commands of the host watch session (F8's S9, odd/tasks/f8-s9-host-watch.md), which
// reviews each Claude Desktop update in depth instead of a check that nothing broke. `draft` cuts the update's span of
// both changelogs and prints the review file with one row an entry; `check` holds a finished review file to its span,
// read from the excerpts committed beside it; `tools` diffs the app's tool list against the one recorded for that
// surface. The placing and the checks are bin/lib/host-watch.mjs; this file reads and writes. The versions default to
// the reviewed record of doctor's cache and the versions doctor reads now (bin/lib/host-update.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { readCache } from './lib/cache.mjs';
import { harnessHome } from './lib/home.mjs';
import { readHostVersions } from './lib/host-update.mjs';
import { CODE_CHANGELOG, DESKTOP_CHANGELOG, checkReview, cutSpan, diffTools, draftReview, entriesBetween, hostTools, parseChangelog, parseToolList, renderToolList, surfaceRefusal } from './lib/host-watch.mjs';
import { resolveProjectRoot } from './lib/stack.mjs';

export const USAGE = [
  'Usage: js-harness host-watch draft --desktop <file> --code <file> [--from-desktop <v>] [--to-desktop <v>] [--from-code <v>] [--to-code <v>] [--sources <dir>] [--home <path>]',
  '       js-harness host-watch check <review file>',
  '       js-harness host-watch tools --surface desktop|background --list <file> [--record] [--project <dir>] [--home <path>]',
  '',
  'draft prints the review file of a Claude Desktop update: the Code tab CLI line, a "Desktop tool list: owed" line,',
  'one row an entry of the two changelogs over the update\'s span (Change, Decision, Reason, Map row, Evidence, Windows,',
  'Phone), the entries no harness area places listed under "## To classify by hand", and the sources with their spans.',
  '--desktop and --code are the changelogs as published (the desktop\'s markdown, the CLI\'s CHANGELOG). The span runs',
  'from the reviewed record of doctor\'s cache to the versions doctor reads now; --from-* and --to-* freeze it.',
  '--sources writes the excerpt of each span there, claude-desktop-<v>.desktop.md and .code.md, for check to read.',
  'An entry outside the Code tab is decided ignore; every other is "?", which check and doctor --host-reviewed refuse.',
  'Exit 1 when a changelog stops below the version it reviews.',
  '',
  'check holds a review file to its span: each entry, and each version with no entry, has one row by its id in the',
  'Evidence column; every row is decided with a reason; Windows and Phone say "checked: <how>", "unknown" or "n/a";',
  'the hand list is empty; a "Desktop tool list:" line says baseline, diff or owed. The spans come from the file\'s',
  'title and its sources, the entries from the excerpts in sources/ beside it. Exit 0 when it holds, 1 with each gap.',
  '',
  'tools diffs a tool list (one name a line, as a session transcribes the tools it was given, loaded and deferred) with',
  'docs/host-updates/tools-<surface>.txt of the project: the host\'s names only (MCP servers but the host\'s are counted',
  'and left out). desktop is a session the app started, the only one given start_session; background is claude --bg.',
  'With none recorded it is a baseline; --record writes the list. A removed name is confirmed with ToolSearch',
  'select:<name> before a review claims it. Exit 1 for a list the surface could not give, 2 for a usage error.',
].join('\n');

class HostWatchArgError extends Error {}

const VALUED = {
  draft: ['--desktop', '--code', '--from-desktop', '--to-desktop', '--from-code', '--to-code', '--sources', '--home'],
  check: [],
  tools: ['--surface', '--list', '--project', '--home'],
};
const BOOLEAN = { draft: [], check: [], tools: ['--record'] };

function parseArgs(argv) {
  const [verb, ...rest] = argv;
  if (!Object.hasOwn(VALUED, verb ?? '')) throw new HostWatchArgError(verb === undefined ? 'a subcommand is required: draft, check or tools' : `unknown argument: ${verb}`);
  const flags = {};
  const positional = [];
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (BOOLEAN[verb].includes(token)) flags[token] = true;
    else if (VALUED[verb].includes(token)) {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith('--')) throw new HostWatchArgError(`${token} requires a value`);
      if (flags[token] !== undefined) throw new HostWatchArgError(`${token} is given twice`);
      flags[token] = value;
      i += 1;
    } else if (token.startsWith('-')) throw new HostWatchArgError(`unknown argument: ${token}`);
    else positional.push(token);
  }
  if (verb === 'check' && positional.length !== 1) throw new HostWatchArgError('check takes one review file');
  if (verb !== 'check' && positional.length > 0) throw new HostWatchArgError(`unexpected argument: ${positional[0]}`);
  for (const flag of { draft: ['--desktop', '--code'], check: [], tools: ['--surface', '--list'] }[verb]) {
    if (flags[flag] === undefined) throw new HostWatchArgError(`${verb} requires ${flag}`);
  }
  return { verb, flags, file: positional[0] };
}

const read = (file) => fs.readFileSync(file, 'utf8');

function draft(ctx, flags) {
  const versions = ctx.host();
  const reviewed = ctx.reviewed() ?? {};
  const span = {
    desktop: { from: flags['--from-desktop'] ?? reviewed.desktop, to: flags['--to-desktop'] ?? versions.desktop },
    code: { from: flags['--from-code'] ?? reviewed.code, to: flags['--to-code'] ?? versions.code },
  };
  // What the cache or the app could not give is named with the flag that gives it (the reliability lens on dad0db39, R3-002).
  if (span.desktop.from == null || span.code.from == null) {
    ctx.stderr("js-harness host-watch: doctor's cache holds no reviewed record of the host, or none of its CLI: give the span with --from-desktop and --from-code");
    return 1;
  }
  for (const [key, name] of [['desktop', 'Claude Desktop'], ['code', 'Code tab CLI']]) {
    if (span[key].to === null || span[key].to === undefined) {
      ctx.stderr(`js-harness host-watch: the ${name} version could not be read from the app: give it with --to-${key}`);
      return 1;
    }
  }
  const texts = { desktop: read(flags['--desktop']), code: read(flags['--code']) };
  const spans = {};
  for (const key of ['desktop', 'code']) {
    spans[key] = entriesBetween(parseChangelog(texts[key], key), span[key]);
    if (spans[key].error) {
      ctx.stderr(`js-harness host-watch: the ${key} changelog: ${spans[key].error}`);
      return 1;
    }
  }
  const to = { desktop: span.desktop.to, code: span.code.to };
  if (flags['--sources']) {
    fs.mkdirSync(flags['--sources'], { recursive: true });
    for (const key of ['desktop', 'code']) if (span[key].from !== span[key].to) fs.writeFileSync(path.join(flags['--sources'], `claude-desktop-${to.desktop}.${key}.md`), cutSpan(texts[key], span[key]));
  }
  ctx.stdout(draftReview({ versions: to, reviewed: { desktop: span.desktop.from, code: span.code.from }, desktop: spans.desktop, code: spans.code }));
  return 0;
}

function check(ctx, file) {
  let text;
  try {
    text = read(file);
  } catch (err) {
    ctx.stderr(`js-harness host-watch: the review file ${file} could not be read (${err.code ?? err.message})`);
    return 1;
  }
  const desktop = /^#\s+Claude Desktop\s+(\d+\.\d+\.\d+)\s*$/m.exec(text)?.[1];
  if (!desktop) {
    ctx.stderr(`js-harness host-watch: ${file} has no title "# Claude Desktop <version>"`);
    return 1;
  }
  const spans = [];
  for (const [key, url] of [['desktop', DESKTOP_CHANGELOG], ['code', CODE_CHANGELOG]]) {
    const range = new RegExp(`${url.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\S*\\s+\\((\\d+\\.\\d+\\.\\d+) to (\\d+\\.\\d+\\.\\d+)\\)`).exec(text);
    const named = key === 'desktop' ? desktop : /^Code tab CLI:\s*(\d+\.\d+\.\d+)/m.exec(text)?.[1];
    if (!range) {
      // A source named with no span it can read would drop its changelog from the check (Codex, 2026-10-30).
      if (text.includes(url)) {
        ctx.stderr(`js-harness host-watch: ${file} names ${url} with no span "(<from> to <to>)" check can read`);
        return 1;
      }
      // A version the review names is held to its changelog, so its rows cannot leave with their span (the reliability lens on dad0db39, R3-003).
      if (named) {
        ctx.stderr(`js-harness host-watch: ${file} names ${key === 'desktop' ? 'Claude Desktop' : 'Code tab CLI'} ${named} and no span of ${url} under "## Sources"`);
        return 1;
      }
      continue;
    }
    // The span ends at the version the review names, or newer releases would pass on older research (Codex).
    if (named && range[2] !== named) {
      ctx.stderr(`js-harness host-watch: ${file}: the ${key} changelog span ends at ${range[2]}, and the review names ${named}`);
      return 1;
    }
    // A side that did not move has nothing to read, and draft writes no excerpt for it.
    if (range[1] === range[2]) continue;
    const excerpt = path.join(path.dirname(file), 'sources', `claude-desktop-${desktop}.${key}.md`);
    let source;
    try {
      source = read(excerpt);
    } catch {
      ctx.stderr(`js-harness host-watch: no excerpt ${excerpt} for ${url} (${range[1]} to ${range[2]}): draft --sources writes it`);
      return 1;
    }
    const span = entriesBetween(parseChangelog(source, key), { from: range[1], to: range[2] });
    if (span.error) {
      ctx.stderr(`js-harness host-watch: ${excerpt}: ${span.error}`);
      return 1;
    }
    spans.push({ ...span, source: key });
  }
  const gaps = checkReview(text, spans);
  for (const gap of gaps) ctx.stderr(`js-harness host-watch: ${file}: ${gap}`);
  if (gaps.length > 0) return 1;
  const entries = spans.reduce((sum, span) => sum + span.entries.length + span.missing.length, 0);
  ctx.stdout(`js-harness host-watch: ${file} holds the review of Claude Desktop ${desktop}: ${entries} rows for ${entries} entries, each decided`);
  return 0;
}

function tools(ctx, flags) {
  const surface = flags['--surface'];
  const { kept, others } = hostTools(parseToolList(read(flags['--list'])));
  const refusal = surfaceRefusal(surface, kept);
  if (refusal) {
    ctx.stderr(`js-harness host-watch: ${refusal}`);
    return 1;
  }
  const project = flags['--project'] ? path.resolve(flags['--project']) : ctx.project();
  const recordFile = path.join(project, 'docs', 'host-updates', `tools-${surface}.txt`);
  let recorded = null;
  try {
    recorded = parseToolList(read(recordFile));
  } catch (err) {
    // No list recorded for this surface yet: this capture is its baseline. Any other failure is said, or --record
    // would write a fresh baseline over a list it could not read (the reliability lens on dad0db39, R3-004).
    if (err.code !== 'ENOENT') {
      ctx.stderr(`js-harness host-watch: the recorded list ${recordFile} could not be read (${err.code ?? err.message})`);
      return 1;
    }
  }
  const diff = diffTools(recorded, kept);
  const left = Object.entries(others).map(([server, count]) => `${server} (${count})`);
  if (diff.baseline) ctx.stdout(`baseline: ${kept.length} host tools on the ${surface} surface; no list was recorded at ${recordFile}`);
  else {
    ctx.stdout(`against ${recordFile}: ${diff.added.length} added, ${diff.removed.length} removed`);
    if (diff.added.length > 0) ctx.stdout(`added: ${diff.added.join(', ')}`);
    if (diff.removed.length > 0) ctx.stdout(`removed: ${diff.removed.join(', ')} (confirm each with ToolSearch select:<name> before a review claims it)`);
  }
  if (left.length > 0) ctx.stdout(`other MCP servers left out: ${left.join(', ')}`);
  if (flags['--record']) {
    fs.mkdirSync(path.dirname(recordFile), { recursive: true });
    fs.writeFileSync(recordFile, renderToolList({ surface, versions: ctx.host(), at: ctx.now().toISOString().slice(0, 10), names: kept }));
    ctx.stdout(`recorded ${recordFile}`);
  }
  return 0;
}

/** The command. The seams are the output, the versions read now (`host`), the reviewed record (`reviewed`), the
 * project (`project`) and the clock (`now`). */
export async function hostWatchMain(argv = [], deps = {}) {
  const stdout = deps.stdout ?? console.log;
  const stderr = deps.stderr ?? console.error;
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof HostWatchArgError)) throw err;
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const home = harnessHome({ given: parsed.flags['--home'], env: deps.env ?? process.env, cwd: deps.cwd ?? process.cwd() });
  const ctx = {
    stdout,
    stderr,
    host: deps.host ?? (() => readHostVersions({ home })),
    reviewed: deps.reviewed ?? (() => readCache(home).host?.reviewed ?? null),
    project: deps.project ?? (() => resolveProjectRoot(deps.cwd ?? process.cwd())),
    now: deps.now ?? (() => new Date()),
  };
  try {
    if (parsed.verb === 'draft') return draft(ctx, parsed.flags);
    if (parsed.verb === 'check') return check(ctx, parsed.file);
    return tools(ctx, parsed.flags);
  } catch (err) {
    if (!err.code) throw err;
    stderr(`js-harness host-watch: ${err.path ?? ''} could not be read or written (${err.code})`);
    return 1;
  }
}
