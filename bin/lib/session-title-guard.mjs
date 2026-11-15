// The title of a session started with `start_session`, checked by the guard's `PreToolUse` hook
// (odd/tasks/session-title.md). A session's title carries its role: the board, the roster, `notify --to <n>` and the
// openings read the number from it. On 2026-10-19 three sessions the orchestrator started got free titles, so they had
// no number, and one later called itself "JH 7", a number already used. Only `start_session` loads this file, so the
// session board's module it reads the title shape from costs nothing on the other calls the guard checks.

import { roleOfTitle } from './sessions.mjs';
import { EFFORTS, SENIOR_HOME, claudeHeld, sameClaudeModel } from './model-home.mjs';
import { guardHeld, ruleHere } from './rules.mjs';

/** Whether `title` is the title of a lead, `<code> ORQ · <purpose>`: the start of a session so titled is held to the
 * rule `lead-effort`, and every other to `session-effort` (`sessionStartRefusal` of ./guard.mjs). Only the shape is
 * read: a title with another project's code is a lead's here and refused for its code by `sessionTitleRefusal`. */
export const leadTitle = (title) => roleOfTitle(title)?.role === 'orchestrator';

/** Whether `title` is the title of a senior, `<code> SR · <purpose>`: its start and its resume are held to the rule
 * `senior-model`, with no advisor (odd/tasks/senior-orchestrator.md). */
export const seniorTitle = (title) => roleOfTitle(title)?.role === 'senior';

/** Why the `start_session` call whose input is `toolInput` is refused, or null. Where the rule `session-title` is
 * declared (`projectData`, the text of the project's rules file), a call that carries a `title` is refused when that
 * title is not of the agreed shape (`roleOfTitle`) with the project's own code: a work session's `<code> <n> ·
 * <purpose>`, or `<code> ORQ · <purpose>` for a new lead, which the orchestrator skill starts with this tool when it
 * rotates the lead. An offer is refused too, since the title it shows becomes the session's. A call with no title (a
 * proposal started as proposed) passes. Only the shape is held: whether the number is free is said in the refusal,
 * not checked. `project.codeOf()` gives `{ code }`, the project's code from harness.json (`projectCode` of
 * ./sessions.mjs), `null` where it declares none, and throws where it cannot be read: then every title is refused and
 * told to declare it (S5). `project.next(code)` gives the project's next free number (`nextSessionNumber` of
 * ./channel.mjs) and is called only to word a refusal, so a good title reads no record. `who` names the caller in the
 * reasons: `js-harness sessions start` holds its `--title` to the same rule (odd/tasks/background-sessions.md, S5).
 * Behind a project that declares the rule, the copy's value is held (`guardHeld`), and its note ends the refusal. */
export function sessionTitleRefusal(toolInput, projectData, project, who = 'js-harness guard: start_session') {
  if (!Object.hasOwn(toolInput ?? {}, 'title')) return null;
  const held = guardHeld('session-title', ruleHere('session-title', undefined, projectData));
  if (held === null) return null;
  const reason = titleReason(toolInput.title, held.value, project, who);
  return reason === null ? null : `${reason}${held.note}`;
}

/** Why the session titled `title` is refused under the rule session-title of value `value`, or null. */
function titleReason(title, value, project, who) {
  const shown = typeof title === 'string' ? JSON.stringify(title) : 'with no text';
  let code;
  try {
    ({ code } = project.codeOf());
  } catch (err) {
    return `${who} titles the session ${shown}, and the code of this project could not be read (${err.message}), so no title can be checked (rule session-title: ${value}). Fix "code" in harness.json, the project's own identifier such as "JH", then title it "<code> <n> · <purpose>" with the number js-harness sessions --next-number prints.`;
  }
  if (code === null) {
    return `${who} titles the session ${shown}, and this project declares no code for it (rule session-title: ${value}). Add "code" to harness.json, the project's own identifier such as "JH", then title it "<code> <n> · <purpose>" with the number js-harness sessions --next-number prints.`;
  }
  if (roleOfTitle(title)?.code === code) return null;
  const refused = `${who} titles the session ${shown}, not ${value}, which is ${code} here (rule session-title; a new lead is ${code} ORQ · <purpose>). `;
  let found;
  try {
    found = project.next(code);
  } catch (err) {
    // The title is refused whatever the number: a reader that fails only takes the number out of the reason.
    return `${refused}Title it "${code} <n> · <purpose>": the next number could not be read (${err.message}), so take it from js-harness sessions --next-number.`;
  }
  const { number, unavailable = [] } = found;
  const blind = unavailable.length > 0 ? `; it could not read ${unavailable.join(' and ')}, so check it with js-harness sessions --next-number` : '';
  return `${refused}Title it "${code} ${number} · <purpose>": ${number} is one past the highest number of ${code} in this project's channel and openings${blind === '' ? ' (js-harness sessions --next-number).' : `${blind}.`}`;
}

/** Why the lead's `start_session` of a senior (`seniorTitle`), whose input is `toolInput`, is refused, or null
 * (odd/tasks/senior-orchestrator.md, T6: his words of 2026-11-15 ask for every session visible and started by the
 * lead). `projectData` is the text of the project's rules file; `starter` the app record of the calling session
 * (`{ title, effort }`), null where no id, no record or no read gave one; `records` every app record, for the live
 * seniors, empty where they could not be read. Only the lead starts one (`seniorStarterRefusal` of
 * ../sessions-background.mjs holds the command the same way): a start that cannot tell the caller is refused. It
 * carries its brief, since an offer's brief comes later with no title the guard could hold. It names no model: the
 * tool caps one at the caller's, so a named senior model would run on the lead's; the lead sets it after with
 * `set_session_model`, and `seniorMessageRefusal` holds it before any task. It keeps its own worktree, since
 * `detach_session` refuses a session that shares one, and starts while no other senior of the code is live (D4). The
 * level it names is held by `sessionStartRefusal` with `senior`, after this. */
export function seniorStartRefusal(toolInput, projectData, { starter = null, records = [] } = {}) {
  const title = JSON.stringify(toolInput?.title ?? '');
  const who = 'js-harness guard: start_session';
  const home = claudeHeld(projectData);
  if (home.senior === null) return `${who} titles the session ${title}, a senior, and this project declares no rule senior-model, so it has no senior to start.`;
  if (starter === null || !leadTitle(starter.title ?? '')) {
    const caller = starter === null ? 'the session that calls it is not run from a session, or has no app record that can be read' : `the session that calls it is titled ${JSON.stringify(starter.title ?? '')}`;
    return `${who}: a senior is started by the lead (the orchestrator, titled "<code> ORQ · <purpose>"), and ${caller}, so ${title} was not started: the user asks the lead to start it.`;
  }
  if (typeof toolInput.prompt !== 'string' || toolInput.prompt === '') {
    return `${who} offers the senior ${title} with no brief: a senior's start carries its brief (initiation "user_asked", on a turn the user typed), since the brief that follows an offer carries no title the guard could hold to the senior's rules.`;
  }
  if (typeof toolInput.model === 'string' && toolInput.model !== '') {
    return `${who} names the model "${toolInput.model}" for the senior ${title}: the tool caps a start at the caller's model, so name none, then set rule ${SENIOR_HOME.model} (${home.senior.value}) with set_session_model once it has started.${home.senior.note}`;
  }
  if (toolInput.use_worktree === false) {
    return `${who} starts the senior ${title} with use_worktree false: detach_session refuses a session that shares another's worktree, so leave it out or pass true.`;
  }
  const level = home.seniorEffort;
  if (level !== null && EFFORTS.includes(starter.effort) && EFFORTS.indexOf(starter.effort) < EFFORTS.indexOf(level.value)) {
    return `${who} is called from a session at the level "${starter.effort}", under the one of the rule ${SENIOR_HOME.effort}: ${level.value}, and a start is capped at the session that makes it: the user sets the lead's level first.${level.note}`;
  }
  const code = roleOfTitle(toolInput.title)?.code;
  const live = records.find((record) => record?.archived !== true && seniorTitle(record?.title ?? '') && roleOfTitle(record.title)?.code === code);
  if (live !== undefined) {
    return `${who} starts the senior ${title} while ${JSON.stringify(live.title)} is live: one live senior at a time (odd/tasks/senior-orchestrator.md, D4). Send that one the task, or archive it first.`;
  }
  return null;
}

/** Why a message to the session `target` names (a `local_…` app id) is refused, or null: the check that holds a
 * senior to its rules (odd/tasks/senior-orchestrator.md, T6, D9). `record` is the target's app record, null where none
 * was found. A record titled as a senior whose model or level is not that of the rules `senior-model` and
 * `senior-effort` gets no task until the lead sets them with its session tools: a senior started with `start_session`
 * runs on the lead's model until `set_session_model` changes it. Any other record, or none, passes. */
export function seniorMessageRefusal(record, projectData) {
  if (record === null || typeof record !== 'object' || !seniorTitle(record.title ?? '')) return null;
  const home = claudeHeld(projectData);
  const off = [];
  if (home.senior !== null && !(typeof record.model === 'string' && sameClaudeModel(record.model, home.senior.value))) {
    off.push(`the model ${record.model ?? 'none'}, not the one of the rule ${SENIOR_HOME.model}: ${home.senior.value} (set_session_model)`);
  }
  if (home.seniorEffort !== null && record.effort !== home.seniorEffort.value) {
    off.push(`the level ${record.effort ?? 'none'}, not the one of the rule ${SENIOR_HOME.effort}: ${home.seniorEffort.value} (set_session_effort)`);
  }
  if (off.length === 0) return null;
  const notes = [home.senior?.note ?? '', home.seniorEffort?.note ?? ''].join('');
  return `js-harness guard: the senior ${JSON.stringify(record.title)} gets no task while its app record holds ${off.join(', and ')}. Set it with those session tools first; they apply from its next turn.${notes}`;
}
