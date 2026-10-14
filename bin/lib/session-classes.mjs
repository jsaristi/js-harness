// The `session-classes` check of `doctor` (section 10 of odd/tasks/session-channel.md, built as T5 of
// odd/tasks/commands-and-doctor.md). Claude Code groups sessions into two classes, those that bypass
// permission prompts and every other, and with `crossSessionInbound` unset it holds a message that
// crosses from one class to the other; in the desktop app a held message has no dialog and is dropped
// when it expires (https://code.claude.com/docs/en/cross-session-messaging, read 2026-10-14). He
// chose that the setting be `accept` (2026-10-11); this check says when the project's recent sessions
// are of both classes and nothing joins them, and its fix is the install flag that sets it.
import fs from 'node:fs';
import path from 'node:path';
import { mainCheckout, projectSlug } from './sessions.mjs';

const RECENT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
// The newest transcripts only, and the end of each: the check also runs as a session-start hook.
const MAX_SESSIONS = 30;
const TAIL_BYTES = 512 * 1024;
const BYPASS = 'bypassPermissions';

export const SESSION_CLASSES_FIX =
  'js-harness install --accept-session-messages, which sets crossSessionInbound to "accept" in the user settings (uninstall puts back what was there):';

/** The permission mode the last user entry of a transcript's text carries, or `null`. */
export function lastPermissionMode(text) {
  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (!lines[i].includes('"permissionMode"')) continue;
    try {
      const entry = JSON.parse(lines[i]);
      if (entry?.type === 'user' && typeof entry.permissionMode === 'string') return entry.permissionMode;
    } catch {
      // The first line of a tail is cut, and any line may not parse: it carries no mode.
    }
  }
  return null;
}

function tailOf(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const length = Math.min(size, TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, size - length);
    return buffer.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

/** How the user settings under `home` set `crossSessionInbound`, as words for the line. */
function settingWords(file) {
  if (!fs.existsSync(file)) return { accept: false, words: `is not set in ${file}` };
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8'))?.crossSessionInbound;
  } catch {
    return { accept: false, words: `cannot be read in ${file}` };
  }
  if (value === undefined) return { accept: false, words: `is not set in ${file}` };
  return { accept: value === 'accept', words: `is ${JSON.stringify(value)} in ${file}` };
}

/** The check's cells and line: `mismatch` when the project's sessions of the last week are of both classes and the
 * user setting is not `accept`, with one line that counts them and says what the setting is; `ok` otherwise; `n/a`
 * when the project has no sessions folder; `unknown` when anything throws. A session whose mode is not in the end of
 * its transcript counts in no class. The folder is the main checkout's, where Claude Code keeps a repository's
 * sessions. Settings above the user's (managed, `--settings`) are not read. */
export function sessionClassesState({ home, project, spawn, now = Date.now }) {
  try {
    const run = (command, args, options) => spawn(command, args, { ...options, encoding: 'utf8', windowsHide: true });
    const folder = path.join(home, '.claude', 'projects', projectSlug(mainCheckout(run, project)));
    if (!fs.existsSync(folder)) return { claude: 'n/a', codex: 'n/a', lines: [] };
    const since = now() - RECENT_DAYS * DAY_MS;
    const recent = fs.readdirSync(folder)
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => ({ file: path.join(folder, name), at: fs.statSync(path.join(folder, name)).mtimeMs }))
      .filter(({ at }) => at >= since)
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_SESSIONS);
    let bypass = 0;
    let asking = 0;
    for (const { file } of recent) {
      const mode = lastPermissionMode(tailOf(file));
      if (mode === BYPASS) bypass += 1;
      else if (mode !== null) asking += 1;
    }
    const setting = settingWords(path.join(home, '.claude', 'settings.json'));
    if (bypass === 0 || asking === 0 || setting.accept) return { claude: 'ok', codex: 'n/a', lines: [] };
    const line = `${bypass} of the project's sessions of the last ${RECENT_DAYS} days bypass permission prompts and ${asking} ${asking === 1 ? 'asks' : 'ask'} for them; ` +
      `crossSessionInbound ${setting.words}, so a message from one class to the other is held`;
    return { claude: 'mismatch', codex: 'n/a', lines: [line] };
  } catch {
    return { claude: 'unknown', codex: 'n/a', lines: [] };
  }
}
