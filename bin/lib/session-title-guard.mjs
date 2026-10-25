// The title of a session started with `start_session`, checked by the guard's `PreToolUse` hook
// (odd/tasks/session-title.md). A session's title carries its role: the board, the roster, `notify --to <n>` and the
// openings read the number from it. On 2026-10-19 three sessions the orchestrator started got free titles, so they had
// no number, and one later called itself "JH 7", a number already used. Only `start_session` loads this file, so the
// session board's module it reads the title shape from costs nothing on the other calls the guard checks.

import { roleOfTitle } from './sessions.mjs';
import { ruleHere } from './rules.mjs';

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
 * reasons: `js-harness sessions start` holds its `--title` to the same rule (odd/tasks/background-sessions.md, S5). */
export function sessionTitleRefusal(toolInput, projectData, project, who = 'js-harness guard: start_session') {
  if (!Object.hasOwn(toolInput ?? {}, 'title')) return null;
  const rule = ruleHere('session-title', undefined, projectData);
  if (!Object.hasOwn(rule, 'value')) return null;
  const title = toolInput.title;
  const shown = typeof title === 'string' ? JSON.stringify(title) : 'with no text';
  let code;
  try {
    ({ code } = project.codeOf());
  } catch (err) {
    return `${who} titles the session ${shown}, and the code of this project could not be read (${err.message}), so no title can be checked (rule session-title: ${rule.value}). Fix "code" in harness.json, the project's own identifier such as "JH", then title it "<code> <n> · <purpose>" with the number js-harness sessions --next-number prints.`;
  }
  if (code === null) {
    return `${who} titles the session ${shown}, and this project declares no code for it (rule session-title: ${rule.value}). Add "code" to harness.json, the project's own identifier such as "JH", then title it "<code> <n> · <purpose>" with the number js-harness sessions --next-number prints.`;
  }
  if (roleOfTitle(title)?.code === code) return null;
  const refused = `${who} titles the session ${shown}, not ${rule.value}, which is ${code} here (rule session-title; a new lead is ${code} ORQ · <purpose>). `;
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
