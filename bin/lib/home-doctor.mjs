// The doctor row of the home for the model and the effort (odd/tasks/one-model-home.md, spec 7): whether the session
// that asks is on the home its project's rules declare, judged by the app's record of it (his menu), with the line to
// give the user when it is not, since a session cannot change its own; and, as the row's note, what his settings say
// that the home does not. On 2026-11-10 a lead ran a day above the level its rule gave and nothing told it. It reads
// the app's record, his user settings and the project's local settings, and writes none of them: the settings are his.
import fs from 'node:fs';
import path from 'node:path';
import { appRoot, appSessions } from './app-record.mjs';
import { EFFORTS, heldValues, menuLine, offHome, sameClaudeModel } from './model-home.mjs';
import { leadTitle } from './session-title-guard.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const said = ({ model, effort }) => `${model ?? 'no model'} at ${effort ?? 'no level'}`;

/** What his settings say that `home` (`{ model, effort, lead }`) does not, as sentences: `user` is his user settings
 * and `project` the project's local ones, each the parsed object or null when there is none. His default model, which
 * a session started outside the harness runs on; a cap of the effort under the highest level the home gives; the
 * entry of the home's model under `modelSettings`, missing or at another level; and the `effortLevel` either file
 * holds, which a new session takes. A short name is the home's model for no one (`sameClaudeModel`). */
export function settingsNotes(home, { user = null, project = null } = {}) {
  const notes = [];
  if (typeof home.model === 'string' && typeof user?.model === 'string' && !sameClaudeModel(user.model, home.model)) {
    notes.push(`his settings' default model is ${user.model}, not the home's ${home.model}: a session started outside the harness runs on it`);
  }
  const top = [home.effort, home.lead].filter((level) => EFFORTS.includes(level)).sort((one, other) => EFFORTS.indexOf(other) - EFFORTS.indexOf(one))[0];
  if (top !== undefined && EFFORTS.includes(user?.maxEffortLevel) && EFFORTS.indexOf(user.maxEffortLevel) < EFFORTS.indexOf(top)) {
    notes.push(`his settings cap the effort at ${user.maxEffortLevel}, under the home's ${top}`);
  }
  if (typeof home.model === 'string' && isObject(user)) {
    const entry = isObject(user.modelSettings) ? user.modelSettings[home.model] : undefined;
    if (!isObject(entry)) notes.push(`his settings hold no modelSettings entry for ${home.model}`);
    else if (typeof entry.effortLevel === 'string' && typeof home.effort === 'string' && entry.effortLevel !== home.effort) {
      notes.push(`his settings hold ${entry.effortLevel} for ${home.model} under modelSettings, not the home's ${home.effort}`);
    }
  }
  for (const [whose, settings] of [['his settings hold', user], ['the project\'s .claude/settings.local.json holds', project]]) {
    if (typeof home.effort === 'string' && typeof settings?.effortLevel === 'string' && settings.effortLevel !== home.effort) {
      notes.push(`${whose} effortLevel ${settings.effortLevel}, not the home's ${home.effort}: a new session takes it`);
    }
  }
  return notes;
}

/** The object in the JSON `file`, or null when it is missing, cannot be read or is no object. */
function jsonOf(readFile, file) {
  try {
    const data = JSON.parse(readFile(file));
    return isObject(data) ? data : null;
  } catch {
    return null;
  }
}

/** His settings as `settingsNotes` takes them, `{ user, project }`: the user settings under `claudeDir` and the local
 * settings of the project `project`, each the parsed object, or null when it is missing or cannot be read. Read and
 * never written; the doctor row and `js-harness rules switch` both read them here. */
export function readSettings({ claudeDir, project, readFile = (file) => fs.readFileSync(file, 'utf8') }) {
  return { user: jsonOf(readFile, path.join(claudeDir, 'settings.json')), project: jsonOf(readFile, path.join(project, '.claude', 'settings.local.json')) };
}

/** The doctor row's reading, `{ state, note, fix }`, for the session `env.CLAUDE_CODE_SESSION_ID` names in the
 * project `project`, whose rules file has the text `rulesText` (null when it has none). `n/a` where the project
 * declares no home. `stale` when the app's record of the session holds another model or level than it is held to,
 * the lead's level for a lead (`leadTitle` of the record's title): the fix says what it holds and gives the line for
 * the user. `ok` otherwise; the note then says when the session was not checked, with no session id or no app record
 * of it. The note carries `settingsNotes` in every state. `claudeDir` is the folder of his user settings. */
export function modelHomeHealth({
  project, rulesText, claudeDir, env = process.env, homedir, platform = process.platform,
  readApp = () => {
    const root = appRoot(env, platform, homedir());
    return root === null ? new Map() : appSessions(root);
  },
  readFile = (file) => fs.readFileSync(file, 'utf8'),
}) {
  const home = heldValues(rulesText);
  if (![home.model, home.effort, home.lead].some((value) => typeof value === 'string')) return { state: 'n/a', note: '', fix: [] };
  const notes = [];
  const fix = [];
  const id = env.CLAUDE_CODE_SESSION_ID;
  let record = null;
  if (typeof id !== 'string' || id === '') notes.push('not asked from a session, so no session was checked');
  else {
    try {
      record = readApp().get(id) ?? null;
    } catch {
      record = null;
    }
    if (record === null) notes.push('this session has no app record that can be read, so its model and level were not checked (js-harness rules applied lists the sessions off the home)');
  }
  if (record !== null) {
    const lead = leadTitle(record.title ?? '');
    const held = { model: home.model, effort: (lead ? home.lead ?? home.effort : home.effort) ?? null };
    if (offHome(record, held) !== null) {
      const who = lead ? 'only the user changes a lead\'s' : 'the lead sets it with its session tools, or the user in the menu';
      const line = typeof held.model === 'string' && typeof held.effort === 'string' ? ` To give him: ${menuLine(held)}` : '';
      fix.push(`this session's menu holds ${said(record)} and it is held to ${said(held)}; a session cannot change its own: ${who}.${line}`);
    }
  }
  notes.push(...settingsNotes(home, readSettings({ claudeDir, project, readFile })));
  return { state: fix.length > 0 ? 'stale' : 'ok', note: notes.join('; '), fix };
}
