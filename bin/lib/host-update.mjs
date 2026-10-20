// The host-update row of `doctor`: the Claude Desktop app and the Claude Code CLI bundled for its Code tab, read
// from the app's own folder, and compared with the versions last reviewed (the `host` record of the doctor cache,
// bin/lib/cache.mjs). An update stays a gap until its review is recorded (`doctor --host-reviewed`), and an update
// the app downloaded but did not apply is a gap of its own: on Windows an MSIX update waits while the app, its tray
// icon included, is open (odd/tasks/host-update-check.md). Every read fails open: nothing here throws.
import fs from 'node:fs';
import path from 'node:path';
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
      if (/^Claude_/.test(name)) folders.push(path.join(packages, name, 'LocalCache', 'Roaming', 'Claude'));
    }
  } catch {
    // No Packages folder: only AppData\Roaming is looked in.
  }
  folders.push(path.join(home, 'AppData', 'Roaming', 'Claude'));
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

/** The words of an update from `reviewed` to `now`: the desktop's range, the CLI's, or both; `null` for none. */
function updateWords(reviewed, now) {
  const desktop = reviewed.desktop !== now.desktop ? `Claude Desktop ${reviewed.desktop} → ${now.desktop}` : null;
  const code = now.code && reviewed.code && reviewed.code !== now.code ? `${reviewed.code} → ${now.code}` : null;
  if (desktop && code) return `${desktop} and its Code tab CLI ${code}`;
  return desktop ?? (code ? `the Code tab CLI ${code}` : null);
}

/** `{ row, record }`: the `host-update` row of `doctor` for the versions read and the reviewed ones (the cache's
 * `host.reviewed`, or `null`), and the record to write: the versions read, taken as reviewed, when there is no
 * record yet and the running version was read; `null` otherwise. */
export function hostUpdateRow(versions, reviewed, now = () => new Date()) {
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
      // A restart of the app turns Remote Control off; his standing yes to turning it back on each time is in
      // odd/tasks/host-update-check.md (L9).
      'turn Remote Control back on in each work session without asking the user (a standing yes of 2026-10-15); a session that has run no turn since the restart refuses it, so send it a message first',
      'report to the user a full summary in everyday words: what improved, what changed and what was fixed; for each, how it helps or hurts the harness and the way the user works; and what the harness should change to work better, or must change; a version the changelog has no entry for is reported as having none',
      'then record the review: js-harness doctor --host-reviewed',
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
