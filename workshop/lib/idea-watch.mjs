// The idea watch (odd/tasks/idea-watch.md; the reverse-engineering document's section 5): gentle-ai is not
// installed here, and its repository stays a source of ideas, read on each stable release. This module places each
// path a release changed in the area of the harness it could change, drafts the release's entry of the record
// (odd/tasks/gentle-ai-update-check.md) with a verdict to give per area, keeps the paths no area matches apart to be
// classified by hand, and reads from the record the last release read. It only proposes: an adopt or an adapt is
// the user's yes, asked through the lead. Pure: every function takes text and returns data or text; the command
// fetches and reads (workshop/bin/idea-watch.mjs).
import { compareSemver } from '../../bin/lib/version.mjs';

/** The repository read, fetched into a bare clone and never built or run. */
export const UPSTREAM = 'https://github.com/Gentleman-Programming/gentle-ai.git';
/** The record of what was read, in the harness's repository. */
export const RECORD = 'odd/tasks/gentle-ai-update-check.md';
/** The heading of the record's section that lists each release read. */
export const RELEASES_HEADING = '## Releases read';

/** The areas a changed path can fall in, in order: the first whose paths match takes it. Section 5's table, with the
 * rows the v4.2.0 → v4.3.1 diff earned for the paths it left unmatched (odd/tasks/idea-watch.md, "Areas the real diff
 * earned"). A path no row matches is never dropped: it is listed by hand, and the row it earns is added here. */
export const AREAS = [
  {
    id: 'workflow',
    look: 'workflow ideas, against our CLAUDE.md lines and the diet\'s sections 3 and 5',
    paths: ['internal/assets/*/orchestrator.md', 'internal/assets/skills/_shared/odd-*', 'internal/components/agentguidance/**'],
  },
  {
    id: 'review',
    look: 'review ideas, against our review flow (S1) and lens agents',
    paths: ['internal/reviewtransaction/**', 'internal/reviewerprovider/**', 'internal/providercontractbundle/**', 'internal/consentenvelope/**', 'internal/components/reviewassets/**', 'contracts/**'],
  },
  {
    id: 'voice',
    look: 'voice changes, against our style\'s copy',
    paths: ['internal/assets/claude/output-style-*', 'internal/assets/claude/persona-*', 'internal/components/persona/**'],
  },
  {
    id: 'skills',
    look: 'changes to the two skills we copied, by name',
    paths: ['internal/assets/skills/**', 'skills/**', 'internal/components/skills/**'],
  },
  {
    id: 'lenses',
    look: 'changes to the four lens prompts we ported at S1',
    paths: ['internal/assets/claude/agents/**'],
  },
  {
    id: 'permissions',
    look: 'changes to the permission defaults we took over (S10)',
    paths: ['internal/components/permissions/**'],
  },
  {
    id: 'mcp',
    look: 'how they register MCP servers (engram, context7), against our stack rows',
    paths: ['internal/components/mcp/**'],
  },
  {
    id: 'complements',
    look: 'how they install and wire the complements we now own',
    paths: ['internal/components/engram/**', 'internal/components/agenthooks/**', 'internal/components/telemetryruntime/**', 'internal/telemetry*/**', 'internal/assets/engram/**', 'internal/components/communitytool/**'],
  },
  {
    id: 'tui',
    look: 'screens and behaviour to port (section 4)',
    paths: ['internal/tui/**'],
  },
  {
    id: 'install',
    look: 'install, update, undo and release ideas, against our manifest',
    paths: ['internal/backup/**', 'internal/state/**', 'internal/managedownership/**', 'internal/components/filemerge/**', 'internal/components/uninstall/**', 'internal/update/**', 'internal/cli/**', 'internal/app/**', 'internal/catalog/**', 'internal/system/**', 'scripts/**', '.github/**'],
  },
  {
    id: 'hosts',
    look: 'how they adapt Claude Code, the one host we serve',
    paths: ['internal/agents/claude/**', 'internal/agents/capabilitymanifest/**', 'internal/agents/*.go'],
  },
  {
    id: 'models',
    look: 'model assignment and presets, against our presets (G14) and routing (S7)',
    paths: ['internal/model/**'],
  },
  {
    id: 'ignore',
    look: 'other hosts, their shell installer, tests and docs (bench and docs read for evidence)',
    ignore: true,
    paths: [
      'internal/shellinstaller/**', 'internal/opencode/**', 'internal/components/{gga,theme}/**',
      'internal/assets/{antigravity,codex,cursor,gemini,generic,hermes,kimi,kiro,qwen,windsurf,opencode,gga}/**',
      'internal/agents/**', 'internal/copilotconfig/**', 'internal/testsupport/**',
      'bench/**', 'e2e/**', 'testdata/**', 'docs/**', 'odd/**', 'README.md', '.goreleaser.yaml',
      'go.mod', 'go.sum', '.gitignore', '.deadcode-baseline.txt',
    ],
  },
];

const escape = (text) => text.replace(/[.+^$()|[\]\\]/g, '\\$&');

/** A path glob as a regular expression: `*` stays inside one folder, `**` crosses any number of them (none too),
 * `{a,b}` is either word. */
function globPattern(glob) {
  let source = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === '*' && glob[i + 1] === '*') {
      source += '.*';
      i += 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '{') {
      const end = glob.indexOf('}', i);
      source += `(?:${glob.slice(i + 1, end).split(',').map(escape).join('|')})`;
      i = end;
    } else source += escape(char);
  }
  return new RegExp(`^${source}$`);
}

const PATTERNS = AREAS.map((area) => ({ id: area.id, patterns: area.paths.map(globPattern) }));

/** The id of the first area whose paths match `file` (a path in the repository, with forward slashes), or `null`. */
export function areaOf(file) {
  return PATTERNS.find((area) => area.patterns.some((pattern) => pattern.test(file)))?.id ?? null;
}

/** `[{ file, added, deleted }]` of `git diff --numstat --no-renames` output, its rows ended by NUL (`-z`, which prints
 * a path as it is, a line break and all) or else by a line break. A binary file counts no lines (`null`). */
export function parseNumstat(text) {
  const count = (cell) => (cell === '-' ? null : Number(cell));
  const all = String(text);
  return all.split(all.includes('\0') ? '\0' : /\r?\n/).filter((row) => row !== '').map((row) => {
    const [added, deleted, ...file] = row.split('\t');
    return { file: file.join('\t'), added: count(added), deleted: count(deleted) };
  });
}

/** `{ areas, unmatched }`: the areas that hold a change, in the order of AREAS, each `{ id, look, ignore, changes }`,
 * and the changes no area matches. */
export function bucket(changes) {
  const areas = AREAS.map((area) => ({ id: area.id, look: area.look, ignore: area.ignore === true, changes: [] }));
  const unmatched = [];
  for (const change of changes) {
    const id = areaOf(change.file);
    if (id === null) unmatched.push(change);
    else areas.find((area) => area.id === id).changes.push(change);
  }
  return { areas: areas.filter((area) => area.changes.length > 0), unmatched };
}

/** The draft's own headings, which `lastRead` reads back. */
const HAND_HEADING = 'To classify by hand:';
const PATHS_HEADING = 'Paths by area:';

const lines = (changes) => {
  const sum = (key) => changes.reduce((total, change) => total + (change[key] ?? 0), 0);
  return `+${sum('added')} -${sum('deleted')}`;
};
const named = (change) => `\`${change.file}\` (${lines([change])})`;

/** The entry of the record for the release `to`, read against `from` on `date`: one line when every change is in an
 * ignored area, else a section with a table of one row an area, its verdict `?` until the reader decides it (an
 * ignored area is decided `ignore`), the paths no area matches under "To classify by hand", and every path named
 * under its area. */
export function draftRelease({ from, to, changes, date }) {
  const head = `v${to} (from v${from}, read ${date})`;
  const { areas, unmatched } = bucket(changes);
  if (unmatched.length === 0 && areas.every((area) => area.ignore)) {
    return `- ${head}: ignore; ${changes.length} paths, all in ignored areas, ${lines(changes)}`;
  }
  const rows = areas.map((area) => `| ${area.id} | ${area.look} | ${area.changes.length} | ${lines(area.changes)} | ${area.ignore ? 'ignore | an ignored area' : '? | '} |`);
  return [
    `### ${head}`,
    '',
    '| Area | What we look for | Paths | Lines | Verdict | Evidence |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
    'A verdict per change: split an area\'s row into one row a change, each adopt, adapt or ignore with its evidence',
    '(file, lines). An adopt or an adapt becomes a task only with the user\'s yes, asked through the lead.',
    '',
    HAND_HEADING,
    ...(unmatched.length === 0 ? ['(none)'] : unmatched.map((change) => `- ${named(change)}`)),
    '',
    PATHS_HEADING,
    ...areas.flatMap((area) => area.changes.map((change) => `- ${area.id}: ${named(change)}`)),
  ].join('\n');
}

/** The stable versions `git ls-remote --tags` lists: plain `v<semver>` tags, each once, in semver order. */
export function stableVersions(text) {
  const versions = new Set();
  for (const line of String(text).split(/\r?\n/)) {
    const version = /\trefs\/tags\/v(\d+\.\d+\.\d+)(?:\^\{\})?$/.exec(line)?.[1];
    if (version) versions.add(version);
  }
  return [...versions].sort(compareSemver);
}

/** The versions of `versions` above `last` (all of them when nothing was read), oldest first. */
export function unreadVersions(versions, last) {
  return versions.filter((version) => last === null || compareSemver(version, last) > 0).sort(compareSemver);
}

/** `{ last, unread }` of the watch: the last release the record `text` holds as read, and the stable releases of the
 * `git ls-remote --tags` output `tags` above it, oldest first. */
export function watchState({ tags, record }) {
  const last = lastRead(record);
  return { last, unread: unreadVersions(stableVersions(tags), last) };
}

/** The one line that says what the watch owes: "N releases not yet read", the last read, and each one owed. */
export function unreadLine({ last, unread }) {
  const count = `${unread.length} release${unread.length === 1 ? '' : 's'} not yet read`;
  const since = last === null ? 'none read yet' : `the last read is v${last}`;
  return `${count} (${since})${unread.length > 0 ? `: ${unread.map((version) => `v${version}`).join(', ')}` : ''}`;
}

/** The fix lines of doctor's `idea-watch` row while a release is owed. */
export const ideaFix = (state) => [unreadLine(state), 'node workshop/js-harness-workshop.mjs idea-watch draft prints the next one\'s entry; paste it into the record and decide it'];

const VERDICT = /^(adopt|adapt|ignore)\b/i;

/** Whether the lines of a drafted section are decided (S5): every row of its table has a verdict, adopt, adapt or
 * ignore, and its evidence, and no path is left in its "To classify by hand" list, read whole, blank lines and all, up
 * to "Paths by area". A cleared cell is not a verdict, so the release stays owed. */
function decided(section) {
  const rows = section.filter((line) => line.startsWith('|') && !/^\|\s*Area\s*\|/.test(line) && !/^\|[\s|:-]+$/.test(line));
  for (const row of rows) {
    const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 6 || !VERDICT.test(cells[4]) || cells[5] === '') return false;
  }
  const hand = section.findIndex((line) => line.trim() === HAND_HEADING);
  if (hand === -1) return true;
  const paths = section.findIndex((line, i) => i > hand && line.trim() === PATHS_HEADING);
  return !section.slice(hand + 1, paths === -1 ? undefined : paths).some((line) => line.trimStart().startsWith('- '));
}

/** The highest version the record `text` holds as read, or `null`: under its "## Releases read" section, a batched
 * line `- v<x> ...` or a section `### v<x> ...` whose verdicts are all decided. */
export function lastRead(text) {
  const all = String(text).split(/\r?\n/);
  const start = all.findIndex((line) => line.trim() === RELEASES_HEADING);
  if (start === -1) return null;
  const end = all.findIndex((line, i) => i > start && /^## /.test(line));
  const body = all.slice(start + 1, end === -1 ? undefined : end);
  const read = [];
  body.forEach((line, i) => {
    const batched = /^- v(\d+\.\d+\.\d+)\b/.exec(line)?.[1];
    if (batched) read.push(batched);
    const section = /^### v(\d+\.\d+\.\d+)\b/.exec(line)?.[1];
    if (!section) return;
    const next = body.findIndex((other, j) => j > i && /^### /.test(other));
    if (decided(body.slice(i + 1, next === -1 ? undefined : next))) read.push(section);
  });
  return read.sort(compareSemver).at(-1) ?? null;
}
