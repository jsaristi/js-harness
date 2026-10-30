// The host watch (F8's S9, odd/tasks/f8-s9-host-watch.md): what turns a Claude Desktop update into a review a
// session can finish. It reads the two changelogs as they are published, cuts the span of the update, places each
// entry in the harness areas it touches, drafts the review file `doctor --host-reviewed` asks for with one row an
// entry, checks that file against the span, and diffs the app's tool list against the last one recorded. It only
// proposes: an entry a harness area touches stays undecided until the session reads it (his answer to question 129
// covers no adoption without his yes). Pure: every function takes text and returns data or text; the command reads
// and writes (bin/host-watch.mjs).
import { cellsOf, DELIMITER_CELL_PATTERN } from './progress.mjs';
import { compareSemver } from './version.mjs';

const VERSION = /^\d+\.\d+\.\d+$/;
export const DESKTOP_CHANGELOG = 'https://claude.com/docs/cowork/claude-desktop-changelog';
export const CODE_CHANGELOG = 'https://code.claude.com/docs/en/changelog';
const NAMES = { desktop: 'Claude Desktop', code: 'Claude Code' };

/** The harness areas an entry can touch, each with the rows of the proposal's map it touches
 * (docs/proposals/claude-app-native-sessions.md, section 4). An entry is placed in every area whose words it holds. */
export const AREAS = [
  { id: 'sessions', rows: '3, 7, 8, 9, 10, 11, 13, 22', pattern: /start_session|nested session|side session|side chat|\/btw|background (?:session|task|agent|command)s?|claude --bg|\barchiv|session rail|sidebar|hand_off|hand off|detach|claude agents|split view|scheduled task|\broutines?\b|Monitor tool|\bWorkflow\b|\/resume|\bresume\b/i },
  { id: 'questions', rows: '4, 5, 6, 24', pattern: /AskUserQuestion|question tool|\bquestions?\b|wrap_up|next-step box|update_plan/i },
  { id: 'hooks', rows: '15, 25; the hooks of section 2', pattern: /\bhooks?\b|PreToolUse|PostToolUse|PermissionRequest|SessionStart|UserPromptSubmit|PreCompact|Notification hook/i },
  { id: 'permissions', rows: '1; guard', pattern: /permission|bypass|auto mode|deny rule|\bdeny\b|\bdenies\b|sandbox|blockWrites|approval|allowlist|workspace trust|isolation guard/i },
  { id: 'mods', rows: '10, 14, 15', pattern: /\bmods?\b|plugin|hooks module|turn\.step/i },
  { id: 'remote', rows: '18, 19', pattern: /Remote Control|remote-control|mobile|phone|\biOS\b|Android|PushNotification|push notification/i },
  { id: 'artifacts', rows: '14', pattern: /artifact/i },
  { id: 'context', rows: '15; resume', pattern: /compact|context window|context usage|prompt cache|usage limit|\/goal|token limit|\beffort\b/i },
  { id: 'git', rows: '21; section 7', pattern: /worktree|\bgit\b|\bbranch|pull request|\bPRs?\b|\bmerge|\bCI\b|Auto-fix|index\.lock/i },
  { id: 'messaging', rows: '12', pattern: /SendMessage|ListAgents|cross-session|other (?:agents and )?sessions|notify_when_idle|messages? (?:to|from) (?:a |an |another )?(?:[\w-]+ )?session/i },
  { id: 'skills', rows: 'the skills and rules of section 2', pattern: /\bskills?\b|CLAUDE\.md|AGENTS\.md|output style|\bmemory\b|subagent|slash command/i },
  { id: 'browser', rows: 'section 6, point 8', pattern: /built-in browser|Claude in Chrome|computer use|\bbrowser\b/i },
];

// A CLI entry that declares its surface is that surface's, whatever its words touch.
const SURFACE_PREFIX = /^(?:\[(?:VSCode|Cloud sessions|Claude Tag|Code Review|JetBrains)\]|(?:Linux|macOS|Self-hosted runner):)/;
// Words of what the harness does not run on: another surface, a provider, a platform. They place an entry outside
// only when no harness area does.
const OUTSIDE = /VS ?Code|JetBrains|Slack|Bedrock|Vertex|Foundry|gateway|macOS|\bMac\b|Linux|GNOME|\bSSH\b|Self-hosted runner|Cowork|\/claude-api|\bMDM\b|HKLM|Dvorak/i;
const OUTSIDE_SECTIONS = ['Cowork', '3P'];
const WINDOWS = /Windows|PowerShell/i;
const PHONE = /mobile|phone|\biOS\b|Android/i;

/** `{ versions, entries }` of a changelog `text` from `source` (`desktop` or `code`): the versions its headings name, in
 * order, and one entry a bullet `{ id, source, version, section, text }`. The CLI's headings are `## 2.1.314`; the
 * desktop's are a bold `**v4.4212.0**` line, after which any other bold line is a section. A line indented under a
 * bullet joins it. */
export function parseChangelog(text, source) {
  const versions = [];
  const entries = [];
  let version = null;
  let section = null;
  let last = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trimEnd();
    const heading = /^##\s+v?(\d+\.\d+\.\d+)\b/.exec(line) ?? /^\*\*v?(\d+\.\d+\.\d+)\*\*/.exec(line.trim());
    if (heading) {
      version = heading[1];
      versions.push(version);
      section = null;
      last = null;
      continue;
    }
    if (version === null) continue;
    const bold = /^\*\*([^*]+)\*\*$/.exec(line.trim());
    if (bold) {
      section = bold[1].trim();
      last = null;
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      const n = entries.filter((entry) => entry.version === version).length + 1;
      last = { id: `${source} ${version} #${n}`, source, version, section, text: bullet[1].trim() };
      entries.push(last);
      continue;
    }
    if (last && /^\s+\S/.test(line)) last.text = `${last.text} ${line.trim()}`;
    else if (line.trim() !== '') last = null;
  }
  return { versions, entries };
}

/** `{ source, entries, missing, error? }`: the entries of the versions after `from` up to `to`, and the versions of
 * that span with no entry (`to` itself when no heading names it). `error` when the changelog's newest version is below
 * `to`: the copy read is older than the version reviewed, and a span cut from it would miss entries. */
export function entriesBetween({ versions, entries }, { from, to }) {
  const source = entries[0]?.source ?? null;
  const top = [...versions].sort(compareSemver).at(-1);
  if (!VERSION.test(String(to)) || !VERSION.test(String(from))) return { source, entries: [], missing: [], error: `a span runs between two versions, got ${from} to ${to}` };
  if (!top || compareSemver(top, to) < 0) return { source, entries: [], missing: [], error: `the changelog read stops at ${top ?? 'no version'}, below ${to}: read a copy that holds ${to}` };
  const within = (version) => compareSemver(version, from) > 0 && compareSemver(version, to) <= 0;
  const span = entries.filter((entry) => within(entry.version));
  const headed = versions.filter(within);
  const missing = headed.filter((version) => !span.some((entry) => entry.version === version));
  if (!headed.includes(to)) missing.push(to);
  return { source, entries: span, missing };
}

/** `{ areas, outside }` of an entry: the ids of the harness areas its words touch, and what places it outside the Code
 * tab (a declared surface; else, with no area, an outside word or the Cowork or 3P section), or null. */
export function classify(entry) {
  const areas = AREAS.filter((area) => area.pattern.test(entry.text)).map((area) => area.id);
  const prefix = SURFACE_PREFIX.exec(entry.text);
  if (prefix) return { areas, outside: prefix[0] };
  if (areas.length > 0) return { areas, outside: null };
  const word = OUTSIDE.exec(entry.text);
  if (word) return { areas, outside: word[0] };
  if (OUTSIDE_SECTIONS.includes(entry.section)) return { areas, outside: `the ${entry.section} section` };
  return { areas, outside: null };
}

const escape = (text) => String(text).replace(/\|/g, '\\|');
const named = (pattern, text) => (pattern.test(text) ? 'unknown (named)' : 'unknown');
const rowsOf = (areas) => areas.map((id) => AREAS.find((area) => area.id === id).rows).join('; ') || '—';

/** One draft row of an entry: `{ id, cells, unplaced }`. An entry outside the Code tab is `ignore` by default, one a
 * harness area touches or none places is `?`, which the gate refuses until the session decides it. */
function draftRow(entry) {
  const { areas, outside } = classify(entry);
  const reason = outside
    ? `outside the Code tab: ${outside}${areas.length > 0 ? ` (its words touch ${areas.join(', ')})` : ''}`
    : areas.length > 0
      ? `touches ${areas.join(', ')}: read and decide`
      : 'no area matched: classify by hand';
  const decision = outside ? 'ignore' : '?';
  return { id: entry.id, unplaced: !outside && areas.length === 0, text: entry.text, cells: [escape(entry.text), decision, reason, rowsOf(outside ? [] : areas), entry.id, named(WINDOWS, entry.text), named(PHONE, entry.text)] };
}

const HEADER = ['Change', 'Decision', 'Reason', 'Map row', 'Evidence', 'Windows', 'Phone'];
const line = (cells) => `| ${cells.join(' | ')} |`;

/** The draft of a review file for the update from `reviewed` to `versions`, from the spans of both changelogs
 * (`entriesBetween`): the CLI line, a `Desktop tool list:` line left `owed`, one row an entry and one a version with no
 * entry, the entries no area placed listed for hand classification, and the sources with their spans. */
export function draftReview({ versions, reviewed, desktop, code }) {
  const rows = [];
  for (const [key, span] of [['desktop', desktop], ['code', code]]) {
    for (const entry of span.entries) rows.push(draftRow(entry));
    for (const version of span.missing) {
      rows.push({ id: `${key} ${version} none`, unplaced: false, cells: [`No changelog entry for ${NAMES[key]} ${version}`, 'ignore', 'the changelog has no entry for this version', '—', `${key} ${version} none`, 'n/a', 'n/a'] });
    }
  }
  const sources = [];
  if (reviewed.desktop !== versions.desktop) sources.push(`- ${DESKTOP_CHANGELOG} (${reviewed.desktop} to ${versions.desktop})`);
  if (versions.code && reviewed.code && reviewed.code !== versions.code) sources.push(`- ${CODE_CHANGELOG} (${reviewed.code} to ${versions.code})`);
  return [
    `# Claude Desktop ${versions.desktop}`,
    '',
    ...(versions.code ? [`Code tab CLI: ${versions.code}`] : []),
    'Desktop tool list: owed',
    '',
    line(HEADER),
    line(HEADER.map(() => '---')),
    ...rows.map((row) => line(row.cells)),
    '',
    '## To classify by hand',
    ...rows.filter((row) => row.unplaced).map((row) => `- ${row.id}: ${row.text}`),
    '',
    '## Sources',
    ...sources,
    '',
  ].join('\n');
}

/** The bullets of the section `## <title>` of `lines`, up to the next heading. */
function bulletsOf(lines, title) {
  const start = lines.findIndex((text) => text.trim().toLowerCase() === `## ${title.toLowerCase()}`);
  if (start === -1) return [];
  const end = lines.findIndex((text, i) => i > start && /^#{1,2}\s/.test(text));
  return lines.slice(start + 1, end === -1 ? undefined : end).filter((text) => /^\s*[-*]\s+\S/.test(text));
}

/** How many entries the review file's `## To classify by hand` list still holds: the gate refuses one that holds any
 * (bin/lib/host-update.mjs, `reviewFileGaps`). */
export const handListCount = (text) => bulletsOf(String(text).split(/\r?\n/), 'To classify by hand').length;

const CELL = /^(?:checked: \S.*|unknown|unknown \(named\)|n\/a)$/;
const plain = (cell) => cell.replace(/[`*_]/g, '').trim();

/** What the review file `text` lacks against the `spans` it reviews (each an `entriesBetween` result), one reason
 * each; none when it holds the review: each entry and each version with no entry has exactly one row, by its id in
 * the Evidence column; every row is decided with a reason, and its Windows and Phone cells say `checked: <how>`,
 * `unknown` or `n/a`; the hand list is empty; and a `Desktop tool list:` line says `baseline`, `diff` or `owed`. */
export function checkReview(text, spans) {
  const gaps = [];
  const lines = String(text).split(/\r?\n/);
  if (!lines.some((entry) => /^Desktop tool list:\s*(?:baseline|diff|owed)\b/.test(entry.trim()))) gaps.push('a line "Desktop tool list: baseline", "diff" or "owed"');
  const header = lines.findIndex((entry) => {
    const cells = cellsOf(entry)?.map((cell) => plain(cell).toLowerCase());
    return cells && HEADER.every((name) => cells.includes(name.toLowerCase()));
  });
  if (header === -1 || !cellsOf(lines[header + 1] ?? '')?.every((cell) => DELIMITER_CELL_PATTERN.test(cell))) {
    gaps.push(`a table with the columns ${HEADER.join(', ')} and a delimiter row under its header`);
    return gaps;
  }
  const names = cellsOf(lines[header]).map((cell) => plain(cell).toLowerCase());
  const at = (row, name) => plain(row[names.indexOf(name)] ?? '');
  const rows = [];
  for (const entry of lines.slice(header + 2)) {
    const cells = cellsOf(entry);
    if (!cells) break;
    rows.push(cells);
  }
  rows.forEach((row, i) => {
    const label = at(row, 'evidence') || `row ${i + 1}`;
    if (!['adopt', 'adapt', 'ignore'].includes(at(row, 'decision').toLowerCase())) gaps.push(`${label}: a Decision of adopt, adapt or ignore (it reads "${at(row, 'decision')}")`);
    if (at(row, 'reason') === '') gaps.push(`${label}: a Reason`);
    if (at(row, 'evidence') === '') gaps.push(`${label}: its Evidence`);
    for (const column of ['Windows', 'Phone']) {
      if (!CELL.test(at(row, column.toLowerCase()))) gaps.push(`${label}: a ${column} cell of "checked: <how>", "unknown" or "n/a" (it reads "${at(row, column.toLowerCase())}")`);
    }
  });
  const ids = spans.flatMap((span) => [...span.entries.map((entry) => entry.id), ...span.missing.map((version) => `${span.source} ${version} none`)]);
  for (const id of ids) {
    const count = rows.filter((row) => at(row, 'evidence') === id).length;
    if (count === 0) gaps.push(`${id}: no row`);
    else if (count > 1) gaps.push(`${id}: ${count} rows`);
  }
  const hand = handListCount(text);
  if (hand > 0) gaps.push(`the list "To classify by hand" holds ${hand} ${hand === 1 ? 'entry' : 'entries'}: decide each in its row and empty it`);
  return gaps;
}

// The host's own MCP servers: what the app or the CLI ships, not what the user or the stack configured.
const HOST_SERVERS = /^(?:claude-in-chrome|Claude_Browser|computer-use|remote-devices|ccd)/;

/** The tool names of a list `text`: one a line, `#` lines and blank ones left out, sorted, each once. */
export const parseToolList = (text) => [...new Set(String(text).split(/\r?\n/).map((name) => name.trim()).filter((name) => name !== '' && !name.startsWith('#')))].sort();

/** `{ kept, others }` of a list of tool `names`: the host's (every name but an MCP one, and those of the host's own
 * servers), sorted, each once; and how many names each other MCP server gave, by server, so a new host server is
 * seen and added to `HOST_SERVERS`. */
export function hostTools(names) {
  const kept = new Set();
  const others = {};
  for (const name of names) {
    const mcp = /^mcp__(.+?)__/.exec(name);
    if (!mcp || HOST_SERVERS.test(mcp[1])) kept.add(name);
    else others[mcp[1]] = (others[mcp[1]] ?? 0) + 1;
  }
  return { kept: [...kept].sort(), others };
}

/** Why a list of `names` cannot be the `surface`'s, or null. Only a session the app started is given
 * `start_session` (the proposal, section 12, step 4): a desktop list without it was read elsewhere or is incomplete,
 * and a background list with it was not read in a `claude --bg` session. */
export function surfaceRefusal(surface, names) {
  if (surface !== 'desktop' && surface !== 'background') return `a surface is desktop or background, not "${surface}"`;
  const has = names.includes('start_session');
  if (surface === 'desktop' && !has) return 'a desktop list holds start_session, which only a session the app started is given; this one does not: it was read in a background session, or it is incomplete';
  if (surface === 'background' && has) return 'a background list does not hold start_session, which only a session the app started is given; this one does: record it as desktop';
  return null;
}

/** `{ baseline, added, removed }` of the `current` names against the `recorded` ones (null when none is recorded:
 * the first capture is a baseline, never everything added). */
export function diffTools(recorded, current) {
  if (recorded === null) return { baseline: true, added: [], removed: [] };
  const before = new Set(recorded);
  const now = new Set(current);
  return { baseline: false, added: current.filter((name) => !before.has(name)), removed: recorded.filter((name) => !now.has(name)) };
}

/** The text of a recorded tool list: its surface, the versions it was read under, the date and how it was read,
 * then one name a line. */
export function renderToolList({ surface, versions, at, names }) {
  return [
    `# surface: ${surface}`,
    `# Claude Desktop ${versions.desktop ?? 'unknown'}, Code tab CLI ${versions.code ?? 'unknown'}`,
    `# recorded: ${at}`,
    '# provenance: transcribed by the model from its tool definitions and its deferred-tool list; a removal is confirmed with ToolSearch select:<name> before a review claims it',
    ...[...new Set(names)].sort(),
    '',
  ].join('\n');
}
