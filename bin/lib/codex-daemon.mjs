// The `codex-daemon` check of `doctor` (odd/tasks/codex-daemon-row.md). Codex runs a managed app-server daemon from
// `<codex home>/packages/app-server-daemon/current`, a junction to `releases/<version>-<target>`; on 2026-10-21 that
// release's `bin\` was empty and the TUI failed with "daemon executable not found", and Codex reinstalls nothing while
// the junction or the daemon's own files stand (odd/tasks/codex-trust-table.md, `## Daemon`). The check reads that
// layout only: the repair writes under the Codex home, which is the user's, so it is named and never run.
import fs from 'node:fs';
import path from 'node:path';

// The daemon's files that keep Codex from installing a new one while `current` is gone (Codex 0.166,
// `prepare_install.rs:113-118`, read in odd/tasks/codex-trust-table.md).
const STATE_FILES = ['daemon.pid', 'daemon.stderr.log', 'daemon-updater.pid', 'daemon-updater.stderr.log'];

export const CODEX_DAEMON_FIX =
  'Codex\'s managed daemon has no executable to start, and Codex installs none while this state stands, so it fails "daemon executable not found". The harness never writes under the Codex home; the repair that worked on 2026-10-30 is yours to run:';

/** The repair of odd/tasks/codex-trust-table.md, `## Daemon`, with the paths of `codexHome`, one step a line. */
function repairLines(codexHome) {
  const pkg = path.join(codexHome, 'packages', 'app-server-daemon');
  const release = path.join(pkg, 'releases', '<version>-<target>');
  return [
    `1. rename ${pkg} to app-server-daemon.broken, kept aside`,
    `2. copy the Codex CLI's own platform package (the vendor/<target> folder of its @openai/codex-<platform> package, which holds bin/ and codex-package.json) to ${release}, <version> being what codex --version says`,
    `3. point ${path.join(pkg, 'current')} at that folder (a junction on Windows: mklink /J; a symlink elsewhere)`,
    '4. codex app-server daemon start, then codex app-server daemon version names that version',
    `undo: codex app-server daemon stop, delete ${pkg}, rename app-server-daemon.broken back`,
  ];
}

const exists = (file) => fs.existsSync(file);

/** The check's cells and lines, read from `codexHome`: `ok` when `current` resolves to a release whose
 * `codex-package.json` names an `entrypoint` that is a file there; `missing` when `current` resolves to no folder, its release
 * lacks that entrypoint, or `current` is gone while one of the daemon's own files is there, the lines saying which and
 * then the repair; `n/a` with neither `current` nor those files (no managed daemon yet, and the next start installs
 * one); `unknown` when the release's `codex-package.json` cannot be read or names no entrypoint, or a path cannot be
 * read. It only reads. */
export function codexDaemonState({ codexHome }) {
  const none = (codex) => ({ claude: 'n/a', codex, lines: [] });
  const missing = (line) => ({ claude: 'n/a', codex: 'missing', lines: [line, ...repairLines(codexHome)] });
  const current = path.join(codexHome, 'packages', 'app-server-daemon', 'current');
  try {
    try {
      fs.lstatSync(current);
    } catch (err) {
      if (err.code !== 'ENOENT') return none('unknown');
      const held = STATE_FILES.map((file) => path.join(codexHome, 'app-server-daemon', file)).find(exists);
      return held ? missing(`${current} is not there, and ${held} keeps Codex from installing a daemon: it fails "daemon executable not found"`) : none('n/a');
    }
    if (!exists(current)) return missing(`${current} points at ${path.resolve(path.dirname(current), fs.readlinkSync(current))}, which is not there`);
    const release = fs.realpathSync(current);
    let entrypoint;
    try {
      entrypoint = JSON.parse(fs.readFileSync(path.join(release, 'codex-package.json'), 'utf8'))?.entrypoint;
    } catch {
      return none('unknown');
    }
    if (typeof entrypoint !== 'string' || entrypoint === '') return none('unknown');
    // A file, not just a path: a folder where the executable should be starts nothing (Codex's review, P2).
    if (fs.statSync(path.join(release, entrypoint), { throwIfNoEntry: false })?.isFile()) return none('ok');
    return missing(`${current} resolves to ${release}, whose codex-package.json names ${entrypoint}, which is not there`);
  } catch {
    return none('unknown');
  }
}
