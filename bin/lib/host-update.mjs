// The host-update row of `doctor`: the Claude Desktop app and the Claude Code CLI bundled for its Code tab, read
// from the app's own folder, and compared with the versions last reviewed (the `host` record of the doctor cache,
// bin/lib/cache.mjs). An update stays a gap until its review is recorded (`doctor --host-reviewed`), and an update
// the app downloaded but did not apply is a gap of its own: on Windows an MSIX update waits while the app, its tray
// icon included, is open (odd/tasks/host-update-check.md). Every read fails open: nothing here throws.
import fs from 'node:fs';
import path from 'node:path';
import { windowsFolder } from './app-record.mjs';
import { handListCount } from './host-watch.mjs';
import { cellsOf, DELIMITER_CELL_PATTERN } from './progress.mjs';
import { ruleHere } from './rules.mjs';
import { compareSemver } from './version.mjs';

const VERSION = /^\d+\.\d+\.\d+$/;
const DESKTOP_CHANGELOG = 'https://claude.com/docs/cowork/claude-desktop-changelog';
const CODE_CHANGELOG = 'https://code.claude.com/docs/en/changelog';

const isVersion = (value) => typeof value === 'string' && VERSION.test(value);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** The app's folders to look in, in order. On Windows the MSIX package keeps its writes in its own LocalCache,
 * which the app sees as %APPDATA%\Claude, so that one comes first. Every path hangs off `home`, never the
 * environment, as the account check's do (bin/lib/stack.mjs): a fixture home is read and nothing else. */
export function appFolders({ platform, home }) {
  if (platform === 'darwin') return [path.join(home, 'Library', 'Application Support', 'Claude')];
  if (platform !== 'win32') return [path.join(home, '.config', 'Claude')];
  const folders = [];
  const packages = path.join(home, 'AppData', 'Local', 'Packages');
  try {
    for (const name of fs.readdirSync(packages)) {
      if (/^Claude_/.test(name)) folders.push(windowsFolder(path.join(packages, name, 'LocalCache', 'Roaming', 'Claude'), path.join(home, 'AppData', 'Local')));
    }
  } catch {
    // No Packages folder: only AppData\Roaming is looked in.
  }
  // The app may have moved either folder to AppData\Local\Claude-Data, leaving a marker that names the new one.
  folders.push(windowsFolder(path.join(home, 'AppData', 'Roaming', 'Claude'), path.join(home, 'AppData', 'Local')));
  return folders;
}

/** The running app version: Sentry's scope names the release that is running, wherever it nests `app_version`. */
function findAppVersion(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 8) return null;
  if (isVersion(value.app_version)) return value.app_version;
  for (const inner of Object.values(value)) {
    const found = findAppVersion(inner, depth + 1);
    if (found) return found;
  }
  return null;
}

/** The text of the rules file of `project` (`bin/lib/rules-data.mjs`), or null where it has none or it cannot be read:
 * the row reads it to say whether a rule of this repository holds there, and fails open like every read here. */
export function readProjectRulesText(project) {
  try {
    return fs.readFileSync(path.join(project, 'bin', 'lib', 'rules-data.mjs'), 'utf8');
  } catch {
    return null;
  }
}

/** `{ found, desktop, staged, code }`: whether an app folder is there, the running desktop version, the version
 * its updater downloaded, and the highest Code tab CLI under `claude-code/`; `null` for what cannot be read.
 * Of `config.json` only the updater's staged version is read: the file also holds OAuth tokens. */
export function readHostVersions({ platform = process.platform, home } = {}) {
  const folder = appFolders({ platform, home }).find((dir) => fs.existsSync(dir));
  if (!folder) return { found: false, desktop: null, staged: null, code: null };
  const desktop = findAppVersion(readJson(path.join(folder, 'sentry', 'scope_v3.json')));
  const stagedValue = readJson(path.join(folder, 'config.json'))?.updaterStagedPayloadKind?.version;
  let clis = [];
  try {
    clis = fs.readdirSync(path.join(folder, 'claude-code')).filter(isVersion);
  } catch {
    // No bundled CLI folder: the CLI is unknown.
  }
  const code = clis.sort(compareSemver).at(-1) ?? null;
  return { found: true, desktop, staged: isVersion(stagedValue) ? stagedValue : null, code };
}

/** The folder of a project that keeps the host reviews, and the file of one desktop version in it. */
export const HOST_REVIEWS = 'docs/host-updates';
export const reviewFileOf = (desktop) => `${HOST_REVIEWS}/claude-desktop-${desktop}.md`;

const DECISIONS = ['adopt', 'adapt', 'ignore'];

/** A cell's text with the markdown around it taken off: backticks and emphasis. */
const plain = (cell) => cell.replace(/[`*_]/g, '').trim();

/** What the review file `text` lacks for an update from `reviewed` to `versions`, one reason each; none when it holds
 * the review: the CLI version read now (when one is read), a table of `Change`, `Decision` and `Reason` whose every
 * row is decided (`adopt`, `adapt` or `ignore`) with its reason, and a `## Sources` list that holds the changelog of
 * each part that changed. */
export function reviewFileGaps(text, versions, reviewed) {
  const gaps = [];
  const lines = String(text).split(/\r?\n/);
  if (versions.code) {
    const named = lines.map((line) => /^\s*Code tab CLI:\s*(\S+)/.exec(plain(line))).find(Boolean);
    if (!named) gaps.push(`a line "Code tab CLI: ${versions.code}"`);
    else if (named[1] !== versions.code) gaps.push(`the Code tab CLI read now, ${versions.code} (it names ${named[1]})`);
  }
  const header = lines.findIndex((line) => {
    const cells = cellsOf(line)?.map((cell) => plain(cell).toLowerCase());
    return cells && ['change', 'decision', 'reason'].every((name) => cells.includes(name));
  });
  const delimiter = header === -1 ? null : cellsOf(lines[header + 1] ?? '');
  if (header === -1) gaps.push('a table with the columns Change, Decision and Reason');
  else if (!delimiter || delimiter.length !== cellsOf(lines[header]).length || !delimiter.every((cell) => DELIMITER_CELL_PATTERN.test(cell))) {
    gaps.push('a delimiter row (|---|---|---|) under the table\'s header');
  } else {
    const names = cellsOf(lines[header]).map((cell) => plain(cell).toLowerCase());
    const at = Object.fromEntries(['change', 'decision', 'reason'].map((name) => [name, names.indexOf(name)]));
    const rows = [];
    for (const line of lines.slice(header + 2)) {
      const cells = cellsOf(line);
      if (!cells) break;
      rows.push(cells);
    }
    if (rows.length === 0) gaps.push('one row at least in the table');
    rows.forEach((cells, i) => {
      const decision = plain(cells[at.decision] ?? '').toLowerCase();
      if (!DECISIONS.includes(decision)) gaps.push(`row ${i + 1}: a Decision of adopt, adapt or ignore (it reads "${decision}")`);
      if (plain(cells[at.reason] ?? '') === '') gaps.push(`row ${i + 1}: a Reason`);
      if (plain(cells[at.change] ?? '') === '') gaps.push(`row ${i + 1}: a Change`);
    });
  }
  // A hand list left with entries is research left undone, however decided the table (Codex, 2026-10-30: one decided
  // row beside an unresolved list passed).
  const hand = handListCount(text);
  if (hand > 0) gaps.push(`the list "To classify by hand" emptied (it holds ${hand}): each entry decided in its row`);
  const start = lines.findIndex((line) => /^##\s+Sources\s*$/i.test(line.trim()));
  if (start === -1) gaps.push('a "## Sources" section');
  else {
    const end = lines.findIndex((line, i) => i > start && /^#{1,2}\s/.test(line));
    const sources = lines.slice(start + 1, end === -1 ? undefined : end).filter((line) => /^\s*[-*]\s+\S/.test(line)).join('\n');
    const needed = [];
    if (reviewed.desktop !== versions.desktop) needed.push([DESKTOP_CHANGELOG, `(${reviewed.desktop} to ${versions.desktop})`]);
    if (versions.code && reviewed.code && reviewed.code !== versions.code) needed.push([CODE_CHANGELOG, `(${reviewed.code} to ${versions.code})`]);
    // Each changelog carries its span from the version last reviewed: `host-watch check` reads the spans the file
    // writes, and only this gate knows where the review starts (the reliability lens, 2026-10-30).
    for (const [url, span] of needed) {
      if (!sources.includes(url)) gaps.push(`${url} among the sources`);
      else if (!sources.split('\n').some((line) => line.includes(url) && line.includes(span))) gaps.push(`the span of ${url} from the version last reviewed, "${span}"`);
    }
    if (sources === '') gaps.push('one source at least under "## Sources"');
  }
  return gaps;
}

/** Why `doctor --host-reviewed` may not record the `versions` read now over the `reviewed` record (the cache's, or
 * `null`) from `project`, or `null` when it may. With no record yet, or the versions already reviewed, there is no
 * update to account for. Otherwise the project's review file of that desktop version must hold its account
 * (`reviewFileGaps`): the review record is the machine's, the file the project's that keeps the reviews. */
export function hostReviewRefusal({ project, versions, reviewed }) {
  const changed = reviewed && (reviewed.desktop !== versions.desktop || (versions.code && reviewed.code && reviewed.code !== versions.code));
  if (!changed) return null;
  const relative = reviewFileOf(versions.desktop);
  let text;
  try {
    text = fs.readFileSync(path.join(project, ...relative.split('/')), 'utf8');
  } catch {
    return `no review file ${relative} in ${project}: the review of Claude Desktop ${versions.desktop} is recorded from the project that keeps the host reviews, once that file holds it (the host-update row's fix says what it holds)`;
  }
  const gaps = reviewFileGaps(text, versions, reviewed);
  return gaps.length === 0 ? null : `${relative} does not hold the review of Claude Desktop ${versions.desktop} yet: it lacks ${gaps.join('; ')}`;
}

/** The words of an update from `reviewed` to `now`: the desktop's range, the CLI's, or both; `null` for none. */
function updateWords(reviewed, now) {
  const desktop = reviewed.desktop !== now.desktop ? `Claude Desktop ${reviewed.desktop} → ${now.desktop}` : null;
  const code = now.code && reviewed.code && reviewed.code !== now.code ? `${reviewed.code} → ${now.code}` : null;
  if (desktop && code) return `${desktop} and its Code tab CLI ${code}`;
  return desktop ?? (code ? `the Code tab CLI ${code}` : null);
}

/** The step of a review that turns Remote Control back on: a restart of the app turns it off. Only where the rule
 * remote-control-yes is declared (`projectData`, the text of the project's rules file), his standing yes of 2026-10-15
 * (odd/tasks/host-update-check.md, L9), is it turned on without asking; anywhere else the user is asked first (his
 * answer Q88, C-shared-5). */
function remoteControlStep(projectData) {
  const restart = 'a session that has run no turn since the restart refuses it, so send it a message first';
  const rule = ruleHere('remote-control-yes', undefined, projectData);
  if (Object.hasOwn(rule, 'value')) {
    return `turn Remote Control back on in each work session without asking the user (rule remote-control-yes: ${rule.value}); ${restart}`;
  }
  return `ask the user whether to turn Remote Control back on in each work session, and turn it on only where they say yes; ${restart}`;
}

/** `{ row, record }`: the `host-update` row of `doctor` for the versions read and the reviewed ones (the cache's
 * `host.reviewed`, or `null`), and the record to write: the versions read, taken as reviewed, when there is no
 * record yet and the running version was read; `null` otherwise. `projectData` is the text of the project's rules
 * file (`readProjectRulesText`), or `null`: it words the Remote Control step of a review (`remoteControlStep`). */
export function hostUpdateRow(versions, reviewed, now = () => new Date(), projectData = null) {
  const row = { id: 'host-update', version: null, installed: 'n/a', claude: 'n/a', codex: 'n/a', project: 'n/a', upToDate: 'n/a', fix: {} };
  if (!versions.found) return { row, record: null };
  if (!versions.desktop) return { row: { ...row, installed: 'unknown', claude: 'unknown', upToDate: 'unknown' }, record: null };
  const read = { ...row, version: versions.desktop, installed: 'ok', claude: 'ok', upToDate: 'ok' };
  const change = reviewed ? updateWords(reviewed, versions) : null;
  // A record whose CLI was not read takes the one read now as its baseline, while the desktop is unchanged: without
  // it no CLI update could ever be seen (Codex, 2026-10-15). With the desktop changed, its review records both.
  const noCliYet = reviewed && reviewed.code === null && versions.code && !change;
  const record = !reviewed || noCliYet ? { desktop: versions.desktop, code: versions.code, at: now().toISOString() } : null;
  if (change) {
    read.claude = 'stale';
    read.change = change;
    read.fix.claude = [
      `${change} since the last review; review the update:`,
      ...(reviewed.desktop !== versions.desktop ? [`read ${DESKTOP_CHANGELOG} from ${reviewed.desktop} to ${versions.desktop}`] : []),
      ...(versions.code && reviewed.code && reviewed.code !== versions.code ? [`read the Claude Code CHANGELOG (${CODE_CHANGELOG}) from ${reviewed.code} to ${versions.code}`] : []),
      'check that the harness hooks in ~/.claude/settings.json still run',
      remoteControlStep(projectData),
      'report to the user a full summary in everyday words: what improved, what changed and what was fixed; for each, how it helps or hurts the harness and the way the user works; and what the harness should change to work better, or must change; a version the changelog has no entry for is reported as having none',
      `write that account to ${reviewFileOf(versions.desktop)} in the project that keeps the host reviews: ${versions.code ? `the line "Code tab CLI: ${versions.code}", ` : ''}a table of Change, Decision (adopt, adapt or ignore) and Reason, one row a change the update brings, and a "## Sources" list of what was read, the changelogs above among it, each with its span "(<from> to <to>)"`,
      'then record the review: js-harness doctor --host-reviewed, which refuses while that file lacks any of it',
    ];
  }
  if (versions.staged && compareSemver(versions.staged, versions.desktop) > 0) {
    read.upToDate = 'outdated';
    read.staged = versions.staged;
    read.fix.upToDate = `Claude Desktop ${versions.staged} is downloaded and not applied (running ${versions.desktop}): quit Claude fully, the tray icon included, and open it again`;
  }
  return { row: read, record };
}

/** What the hook's notice adds for this row: the update since the last review, and a version not applied. */
export function hostNotice(row) {
  const parts = [];
  if (row?.claude === 'stale' && row.change) parts.push(`${row.change} since the last review`);
  if (row?.upToDate === 'outdated' && row.staged) parts.push(`Claude Desktop ${row.staged} is downloaded and not applied`);
  return parts.join('; ');
}
