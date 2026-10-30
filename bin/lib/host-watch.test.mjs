import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { AREAS, checkReview, classify, cutSpan, diffTools, draftReview, entriesBetween, hostTools, parseChangelog, parseToolList, renderBrief, renderToolList, surfaceRefusal, watchLine, watchOpened, watchTitle } from './host-watch.mjs';
import { hostReviewRefusal, reviewFileGaps } from './host-update.mjs';

// The desktop changelog as it is served in markdown (https://claude.com/docs/cowork/claude-desktop-changelog.md):
// a bold version heading, a date, the bundled CLI, bold sections and `* ` bullets. One entry a class, and one no
// class places; a bullet that runs on an indented line; a `|` inside a bullet.
const DESKTOP = `# Changelog

> Release notes for Claude Desktop

**v4.5000.0** (latest)

2026-11-05

Bundled Claude Code version: 2.1.320.

**General**

* Added a way to start a nested session from a side chat.
* Fixed the tray icon flickering
  on some displays.

**Code**

* Added a PreToolUse hook field.
* Changed bypass mode to ask before a | in a path.

**Cowork**

* Fixed the Paused card banner.

**3P**

* Added \`projectsEnabled\` for admins.

**v4.4212.0**

2026-10-29

Bundled Claude Code version: 2.1.309.

**General**

* Added a per-site setting to the built-in browser.

**v4.29.0**

2026-10-20

**General**

* Older entry.
`;

// The CLI's changelog: \`## <version>\` headings and \`- \` bullets, with surface prefixes. 2.1.319 has no entry.
const CODE = `# Changelog

## 2.1.320

- Added mods that draw a pane
- Fixed Remote Control on the phone
- Fixed an artifact publish refused
- Fixed compaction repeating
- Fixed a worktree left behind by git
- Fixed SendMessage to another session
- Fixed a skill unreachable in CLAUDE.md
- Fixed AskUserQuestion holding the session
- [VSCode] Fixed a mod's label over the prompt
- Fixed Bedrock sessions failing
- Windows: Fixed PowerShell permission checks
- Improved the spinner

## 2.1.318

- Fixed an older thing
`;

test('the desktop changelog gives one entry a bullet, with its version, section and id; a run-on line joins its bullet', () => {
  const { versions, entries } = parseChangelog(DESKTOP, 'desktop');
  assert.deepEqual(versions, ['4.5000.0', '4.4212.0', '4.29.0']);
  const latest = entries.filter((entry) => entry.version === '4.5000.0');
  assert.deepEqual(latest.map((entry) => entry.section), ['General', 'General', 'Code', 'Code', 'Cowork', '3P']);
  assert.equal(latest[1].text, 'Fixed the tray icon flickering on some displays.');
  assert.equal(latest[0].id, 'desktop 4.5000.0 #1');
  assert.equal(latest[5].id, 'desktop 4.5000.0 #6');
});

test('the CLI changelog gives one entry a bullet under its version heading', () => {
  const { versions, entries } = parseChangelog(CODE, 'code');
  assert.deepEqual(versions, ['2.1.320', '2.1.318']);
  assert.equal(entries.filter((entry) => entry.version === '2.1.320').length, 12);
  assert.equal(entries[8].text, "[VSCode] Fixed a mod's label over the prompt");
  assert.equal(entries[8].id, 'code 2.1.320 #9');
  assert.equal(entries[0].section, null);
});

test('the span is the versions after the reviewed one up to the one read now; a version with no entry is said', () => {
  const desktop = parseChangelog(DESKTOP, 'desktop');
  const span = entriesBetween(desktop, { from: '4.29.0', to: '4.5000.0' });
  assert.equal(span.error, undefined);
  assert.deepEqual([...new Set(span.entries.map((entry) => entry.version))], ['4.5000.0', '4.4212.0']);
  assert.deepEqual(span.missing, []);
  const code = parseChangelog(CODE, 'code');
  const skipped = entriesBetween(code, { from: '2.1.318', to: '2.1.319' });
  assert.deepEqual(skipped.entries, []);
  assert.deepEqual(skipped.missing, ['2.1.319']);
});

test('a changelog that stops below the version read now is refused: the copy is older than what is reviewed', () => {
  const code = parseChangelog(CODE, 'code');
  const span = entriesBetween(code, { from: '2.1.318', to: '2.1.330' });
  assert.match(span.error, /2\.1\.320.*2\.1\.330/);
});

test('each entry is placed in every harness area it touches, an outside marker or a surface prefix makes it outside, and one with neither is unplaced', () => {
  const { entries } = parseChangelog(CODE, 'code');
  const byText = (start) => classify(entries.find((entry) => entry.text.startsWith(start)));
  assert.deepEqual(byText('Added mods').areas, ['mods']);
  assert.deepEqual(byText('Fixed Remote Control').areas, ['remote']);
  assert.deepEqual(byText('Fixed an artifact').areas, ['artifacts']);
  assert.deepEqual(byText('Fixed compaction').areas, ['context']);
  assert.deepEqual(byText('Fixed a worktree').areas, ['git']);
  assert.deepEqual(byText('Fixed SendMessage').areas, ['messaging']);
  assert.deepEqual(byText('Fixed a skill').areas, ['skills']);
  assert.deepEqual(byText('Fixed AskUserQuestion').areas, ['questions']);
  assert.deepEqual(byText('Windows: Fixed PowerShell permission').areas, ['permissions']);
  const vscode = byText('[VSCode]');
  assert.equal(vscode.outside, '[VSCode]', 'a declared surface wins over the area its words touch');
  assert.deepEqual(vscode.areas, ['mods']);
  assert.equal(byText('Fixed Bedrock').outside, 'Bedrock');
  const spinner = byText('Improved the spinner');
  assert.deepEqual(spinner.areas, []);
  assert.equal(spinner.outside, null);
  const { entries: desktop } = parseChangelog(DESKTOP, 'desktop');
  assert.deepEqual(classify(desktop[0]).areas, ['sessions']);
  assert.deepEqual(classify(desktop[2]).areas, ['hooks']);
  assert.equal(classify(desktop[4]).outside, 'the Cowork section');
  assert.equal(classify(desktop[5]).outside, 'the 3P section');
  for (const area of AREAS) assert.ok(area.rows, `${area.id} names the map rows it touches`);
});

/** The rows of the first table of `text` whose header names a Change, as objects keyed by the header's names. */
function tableOf(text) {
  const lines = text.split('\n');
  const header = lines.findIndex((line) => /^\| Change \|/.test(line));
  const names = lines[header].split('|').slice(1, -1).map((cell) => cell.trim());
  const rows = [];
  for (const line of lines.slice(header + 2)) {
    if (!line.startsWith('|')) break;
    const cells = line.slice(1, -1).split(/(?<!\\)\|/).map((cell) => cell.trim());
    rows.push(Object.fromEntries(names.map((name, i) => [name, cells[i]])));
  }
  return rows;
}

const VERSIONS = { desktop: '4.5000.0', code: '2.1.320' };
const REVIEWED = { desktop: '4.4212.0', code: '2.1.318' };

function draftOfFixtures() {
  const desktop = entriesBetween(parseChangelog(DESKTOP, 'desktop'), { from: REVIEWED.desktop, to: VERSIONS.desktop });
  const code = entriesBetween(parseChangelog(CODE, 'code'), { from: REVIEWED.code, to: VERSIONS.code });
  return { desktop, code, text: draftReview({ versions: VERSIONS, reviewed: REVIEWED, desktop, code }) };
}

test('the draft has one row an entry, the unplaced ones too, each with its id, and lists the unplaced for hand classification', () => {
  const { desktop, code, text } = draftOfFixtures();
  const rows = tableOf(text);
  assert.equal(rows.length, desktop.entries.length + code.entries.length);
  assert.deepEqual(rows.map((row) => row.Evidence), [...desktop.entries, ...code.entries].map((entry) => entry.id));
  const spinner = rows.find((row) => row.Change === 'Improved the spinner');
  assert.equal(spinner.Decision, '?');
  const hand = text.slice(text.indexOf('## To classify by hand'), text.indexOf('## Sources'));
  assert.match(hand, /- code 2\.1\.320 #12: Improved the spinner/);
  assert.match(hand, /- desktop 4\.5000\.0 #2: Fixed the tray icon/);
  assert.equal(rows.find((row) => row.Change.startsWith('Added mods')).Decision, '?', 'a harness area is the session\'s to decide');
  assert.equal(rows.find((row) => row.Change.startsWith('Fixed Bedrock')).Decision, 'ignore');
  assert.match(rows.find((row) => row.Change.startsWith('Fixed Bedrock')).Reason, /outside the Code tab: Bedrock/);
  assert.equal(rows.find((row) => row.Change.startsWith('Changed bypass')).Change, 'Changed bypass mode to ask before a \\| in a path.', 'a | is escaped');
  const windows = rows.find((row) => row.Change.startsWith('Windows:'));
  assert.equal(windows.Windows, 'unknown (named)', 'a name is not a check');
  assert.equal(windows.Phone, 'unknown');
  assert.equal(rows.find((row) => row.Change.startsWith('Fixed Remote Control')).Phone, 'unknown (named)');
  assert.match(text, /^Code tab CLI: 2\.1\.320$/m);
  assert.match(text, /^Desktop tool list: owed$/m);
  assert.match(text, /https:\/\/claude\.com\/docs\/cowork\/claude-desktop-changelog \(4\.4212\.0 to 4\.5000\.0\)/);
  assert.match(text, /https:\/\/code\.claude\.com\/docs\/en\/changelog \(2\.1\.318 to 2\.1\.320\)/);
});

test('a version of the span with no changelog entry is a row that says so, decided ignore', () => {
  const code = entriesBetween(parseChangelog(CODE, 'code'), { from: '2.1.318', to: '2.1.319' });
  const desktop = { entries: [], missing: [] };
  const text = draftReview({ versions: { desktop: '4.4212.0', code: '2.1.319' }, reviewed: { desktop: '4.4212.0', code: '2.1.318' }, desktop, code });
  const rows = tableOf(text);
  assert.deepEqual(rows.map((row) => [row.Change, row.Decision, row.Evidence]), [['No changelog entry for Claude Code 2.1.319', 'ignore', 'code 2.1.319 none']]);
});

/** The draft with every `?` decided and the hand list emptied, as the session leaves it. */
function decided(text) {
  return text
    .replace(/\| \? \|/g, '| adapt |')
    .replace(/(## To classify by hand\n)(?:[\s\S]*?)(\n## Sources)/, '$1$2');
}

test('the check accepts a decided review with one row an entry, and the gate of --host-reviewed accepts it too', () => {
  const { desktop, code, text } = draftOfFixtures();
  const done = decided(text);
  assert.deepEqual(checkReview(done, [desktop, code]), []);
  assert.deepEqual(reviewFileGaps(done, VERSIONS, REVIEWED), []);
});

test('the check refuses an undecided row, a missing or doubled entry, an unresolved hand list, a cell that is no check and no tool-list line', () => {
  const { desktop, code, text } = draftOfFixtures();
  const spans = [desktop, code];
  assert.match(checkReview(text, spans).join('\n'), /code 2\.1\.320 #12: a Decision of adopt, adapt or ignore/);
  assert.match(checkReview(text, spans).join('\n'), /the list "To classify by hand" holds 2 entries/);
  const done = decided(text);
  const missing = done.split('\n').filter((line) => !line.includes('| code 2.1.320 #3 |')).join('\n');
  assert.match(checkReview(missing, spans).join('\n'), /code 2\.1\.320 #3: no row/);
  const row = done.split('\n').find((line) => line.includes('| code 2.1.320 #3 |'));
  assert.match(checkReview(done.replace(row, `${row}\n${row}`), spans).join('\n'), /code 2\.1\.320 #3: 2 rows/);
  assert.match(checkReview(done.replace(row, row.replace('| unknown |', '| named |')), spans).join('\n'), /code 2\.1\.320 #3: a Windows cell of "checked: <how>", "unknown" or "n\/a"/);
  assert.match(checkReview(done.replace('Desktop tool list: owed', ''), spans).join('\n'), /a line "Desktop tool list: baseline", "diff" or "owed"/);
});

test('the gate of --host-reviewed refuses an unresolved hand list: one decided row beside it is not a review', () => {
  const text = [
    '# Claude Desktop 4.5000.0', '', 'Code tab CLI: 2.1.320', '',
    '| Change | Decision | Reason |', '|---|---|---|', '| Mods | adapt | the board |', '',
    '## To classify by hand', '- code 2.1.320 #12: Improved the spinner', '',
    '## Sources', '- https://claude.com/docs/cowork/claude-desktop-changelog (4.4212.0 to 4.5000.0)', '- https://code.claude.com/docs/en/changelog (2.1.318 to 2.1.320)',
  ].join('\n');
  assert.match(reviewFileGaps(text, VERSIONS, REVIEWED).join('\n'), /the list "To classify by hand" emptied/);
});

test('a tool list keeps the host\'s names and counts the other servers\' by server', () => {
  const names = parseToolList('# surface: desktop\nRead\nBash\n\nstart_session\nmcp__engram__mem_save\nmcp__engram__mem_search\nmcp__plugin_engram_engram__mem_save\nmcp__claude-in-chrome__navigate\nmcp__ccd_session_mgmt__list\nmcp__codegraph__codegraph_explore\nBash\n');
  const { kept, others } = hostTools(names);
  assert.deepEqual(kept, ['Bash', 'Read', 'mcp__ccd_session_mgmt__list', 'mcp__claude-in-chrome__navigate', 'start_session']);
  assert.deepEqual(others, { engram: 2, plugin_engram_engram: 1, codegraph: 1 });
});

test('a desktop list without start_session is refused, a background list with it too, and an unknown surface', () => {
  assert.match(surfaceRefusal('desktop', ['Read', 'Bash']), /start_session/);
  assert.match(surfaceRefusal('background', ['Read', 'start_session']), /start_session/);
  assert.match(surfaceRefusal('phone', ['Read']), /desktop or background/);
  assert.equal(surfaceRefusal('desktop', ['Read', 'start_session']), null);
  assert.equal(surfaceRefusal('desktop', ['Read', 'mcp__ccd_session__start_session']), null, 'the app names it under its own server');
  assert.match(surfaceRefusal('background', ['mcp__ccd_session__start_session']), /record it as desktop/);
  assert.equal(surfaceRefusal('background', ['Read']), null);
});

test('the first capture is a baseline; later ones say what was added and removed', () => {
  assert.deepEqual(diffTools(null, ['Read']), { baseline: true, added: [], removed: [] });
  assert.deepEqual(diffTools(['Read', 'Bash', 'Grep'], ['Read', 'Bash', 'Monitor']), { baseline: false, added: ['Monitor'], removed: ['Grep'] });
});

test('a recorded tool list names its surface, versions, date and provenance, and reads back to the same names', () => {
  const text = renderToolList({ surface: 'background', versions: { desktop: '4.4212.0', code: '2.1.309' }, at: '2026-10-30', names: ['Read', 'Bash'] });
  assert.match(text, /^# surface: background$/m);
  assert.match(text, /^# Claude Desktop 4\.4212\.0, Code tab CLI 2\.1\.309$/m);
  assert.match(text, /^# recorded: 2026-10-30$/m);
  assert.match(text, /^# provenance: transcribed by the model/m);
  assert.deepEqual(parseToolList(text), ['Bash', 'Read']);
});

test('the excerpt of a span holds its versions as published, and reads back to the same entries', () => {
  const excerpt = cutSpan(DESKTOP, { from: '4.29.0', to: '4.5000.0' });
  assert.match(excerpt, /^\*\*v4\.5000\.0\*\* \(latest\)$/m);
  assert.doesNotMatch(excerpt, /v4\.29\.0|Older entry|Release notes/);
  const whole = entriesBetween(parseChangelog(DESKTOP, 'desktop'), { from: '4.29.0', to: '4.5000.0' });
  const cut = entriesBetween(parseChangelog(excerpt, 'desktop'), { from: '4.29.0', to: '4.5000.0' });
  assert.deepEqual(cut, whole);
});

test('the excerpt of a span whose last version has no heading keeps the next newer heading, so it reads back as no entry, not as an older copy', () => {
  const span = { from: '2.1.318', to: '2.1.319' };
  const excerpt = cutSpan(CODE, span);
  assert.match(excerpt, /^## 2\.1\.320$/m);
  assert.doesNotMatch(excerpt, /Added mods/);
  assert.deepEqual(entriesBetween(parseChangelog(excerpt, 'code'), span), entriesBetween(parseChangelog(CODE, 'code'), span));
});

test('a markdown escape in an entry is read as the character it escapes, so a published [VSCode] prefix places it', () => {
  const { entries } = parseChangelog(String.raw`**2.1.320**

**Fixed**

* \[VSCode] Fixed a mod's label
`, 'code');
  assert.equal(entries[0].text, "[VSCode] Fixed a mod's label");
  assert.equal(classify(entries[0]).outside, '[VSCode]');
});

// The reliability lens on dad0db39, R3-001: a desktop update that keeps its bundled CLI has a CLI span of nothing.
test('a side whose version did not move has no entries and no missing version, and the draft still names its span', () => {
  const code = entriesBetween(parseChangelog(CODE, 'code'), { from: '2.1.320', to: '2.1.320' });
  assert.equal(code.error, undefined);
  assert.deepEqual([code.entries, code.missing], [[], []]);
  const desktop = entriesBetween(parseChangelog(DESKTOP, 'desktop'), { from: '4.4212.0', to: '4.5000.0' });
  const text = draftReview({ versions: { desktop: '4.5000.0', code: '2.1.320' }, reviewed: { desktop: '4.4212.0', code: '2.1.320' }, desktop, code });
  assert.doesNotMatch(text, /No changelog entry for Claude Code/);
  assert.match(text, /code\.claude\.com\/docs\/en\/changelog \(2\.1\.320 to 2\.1\.320\)/);
});

// R3-003: a row no span names is research nobody can trace to the changelogs read.
test('the check refuses a row whose evidence names no entry of the spans', () => {
  const { desktop, code, text } = draftOfFixtures();
  const done = decided(text);
  const row = done.split('\n').find((line) => line.includes('| code 2.1.320 #3 |'));
  assert.match(checkReview(done.replace(row, `${row}\n${row.replace('code 2.1.320 #3', 'code 2.1.321 #1')}`), [desktop, code]).join('\n'), /code 2\.1\.321 #1: a row no entry of the spans names/);
});

// The trigger (T4, spec S4): the heartbeat names the session to open, titled with the version it reviews.
test('a host watch session is titled with its number and the version it reviews, and found by that version only', () => {
  const title = watchTitle({ code: 'JH', number: 120 }, '4.5000.0');
  assert.equal(title, 'JH 120 · host watch 4.5000.0');
  assert.equal(watchOpened(['JH 109 · host watch: S9 watches Claude releases', 'JH 110 · host watch 4.5000.01'], '4.5000.0'), false);
  assert.equal(watchOpened([null, undefined, title], '4.5000.0'), true);
});

test('the HOST line names the update, the session to open and both ways to open it', () => {
  const line = watchLine({ change: 'Claude Desktop 4.4212.0 → 4.5000.0', version: '4.5000.0', title: 'JH 120 · host watch 4.5000.0', brief: 'C:/h/.js-harness/background/host-watch-4.5000.0.md' });
  assert.match(line, /^HOST: Claude Desktop 4\.4212\.0 → 4\.5000\.0 since the last review/);
  assert.match(line, /start_session/);
  assert.match(line, /js-harness host-watch brief > "C:\/h\/\.js-harness\/background\/host-watch-4\.5000\.0\.md" && js-harness sessions start --title "JH 120 · host watch 4\.5000\.0" --brief "C:\/h\/\.js-harness\/background\/host-watch-4\.5000\.0\.md" --worktree host-watch-4-5000-0 --effort high$/);
});

test('the brief freezes the spans and names every step of the review, in order', () => {
  const brief = renderBrief({ versions: { desktop: '4.5000.0', code: '2.1.320' }, reviewed: { desktop: '4.4212.0', code: '2.1.309' }, title: 'JH 120 · host watch 4.5000.0' });
  assert.match(brief, /^# JH 120 · host watch 4\.5000\.0$/m);
  assert.match(brief, /--from-desktop 4\.4212\.0 --to-desktop 4\.5000\.0 --from-code 2\.1\.309 --to-code 2\.1\.320/);
  const steps = ['host-watch draft', 'every entry', 'Map row', 'host-watch tools', 'plugin-authoring', 'docs/proposals/claude-app-native-sessions.md', 'host-watch check', 'rule:reports-spanish-visual', 'notify --to orchestrator --kind question', 'codex-review', 'lens-review', 'gh pr create', 'doctor --host-reviewed'];
  let at = -1;
  for (const step of steps) {
    const i = brief.indexOf(step);
    assert.ok(i > at, `${step} comes after the step before it`);
    at = i;
  }
  assert.match(brief, /a second update/);
  assert.match(brief, /without his yes/);
});

test('the gate of doctor --host-reviewed accepts the first real review, of 4.29.0 / 2.1.308 to 4.4212.0 / 2.1.309', () => {
  const project = fileURLToPath(new URL('../..', import.meta.url));
  assert.equal(hostReviewRefusal({ project, versions: { desktop: '4.4212.0', code: '2.1.309' }, reviewed: { desktop: '4.29.0', code: '2.1.308' } }), null);
});

// The first real review, desktop 4.4212.0 #24: a Cowork entry that names Code was drafted ignore, outside the Code tab.
test('an entry that names Code is not placed outside by an outside word or its section; one that names Claude Code or VS Code still is', () => {
  const entry = (text, section) => ({ id: 'desktop 4.5000.0 #9', version: '4.5000.0', section, text });
  assert.equal(classify(entry('Added a status line above the message box in Cowork, Chat and Code.', 'Cowork')).outside, null);
  assert.equal(classify(entry('Changed Code sessions to ask before a dev server starts over SSH.', 'Code')).outside, null);
  assert.equal(classify(entry('Changed a setting in Claude Code managed settings, or its MDM policy.', 'General')).outside, 'MDM');
  assert.equal(classify(entry('Fixed a VS Code panel losing its place.', 'General')).outside, 'VS Code');
  assert.equal(classify(entry('Fixed a card in Cowork.', 'Cowork')).outside, 'Cowork');
});
