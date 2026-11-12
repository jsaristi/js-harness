// The one module that reads the two homes of a model and an effort (odd/tasks/one-model-home.md, spec 2).
// Everything Claude the harness starts runs on the Claude home, `session-model` at `session-effort`, the lead's
// session at `lead-effort` since his decision of 2026-11-11, the lenses and the double review's Claude reader at
// `lens-effort` since his of 2026-11-12; a Codex review runs on the Codex home, `review-model`
// at `review-effort`. On 2026-11-10 the user changed model and effort twice in a day, and each change was carried by
// hand through seven rules, three constants and an agent file; a launcher, a guard or a check that needs a model or
// an effort reads it here, so the next change is one place. Which rules the homes are and what shape their values
// have is `model-shape.mjs`, which the rules list reads too; this module gives those names on, so a reader imports
// this one alone. It prints nothing and reads no file: a caller that holds a project's rules file passes its text in.
import { CLAUDE_ID } from './model-shape.mjs';
import { RULES } from './rules-data.mjs';
import { guardHeld, ruleHere, ruleOf } from './rules.mjs';

export { CLAUDE_HOME, CODEX_HOME, EFFORTS, SENIOR_HOME, homeFaults } from './model-shape.mjs';

/** Each level as the app's model menu names it. Medio, Alto and Extra alto are the user's own words for it
 * (2026-11-10); the two ends are assumed, and his to correct. */
export const MENU_LEVELS = Object.freeze({ low: 'Bajo', medium: 'Medio', high: 'Alto', xhigh: 'Extra alto', max: 'Máximo' });

/** The Claude home as `{ model, effort, lead, lenses, advisor }`, the declared values whatever project the caller runs
 * in: the harness's own launches run on `model` everywhere. `effort` is the level of a session and a sub-agent, `lead`
 * the level of the lead's session alone, `lenses` the level of a lens and of the double review's reader; `advisor` the model of the advisor a session it
 * starts consults (odd/tasks/advisor-home.md). A guard, which holds a project to the home only where that project
 * declares the rules, reads `claudeHeld` instead. */
export function claudeHome(list = RULES) {
  return {
    model: ruleOf('session-model', list).value,
    effort: ruleOf('session-effort', list).value,
    lead: ruleOf('lead-effort', list).value,
    lenses: ruleOf('lens-effort', list).value,
    advisor: ruleOf('advisor-model', list).value,
  };
}

/** The Codex home as `{ model, effort }`. `bin/codex-review.mjs` keeps the read its launches use; this one is for
 * what shows or switches both homes. */
export function codexHome(list = RULES) {
  return { model: ruleOf('review-model', list).value, effort: ruleOf('review-effort', list).value };
}

/** What a guard holds of the Claude home in the project whose rules file has the text `projectData`, as
 * `{ model, effort, lead, lenses, advisor }`, each `{ value, note }` as `guardHeld` gives it, or null where the project does
 * not declare that rule: a project that installs the harness is held to nothing, one that declares no level for its
 * lead holds a lead to none of its own, and one that declares no advisor starts its sessions with none. */
export function claudeHeld(projectData) {
  return {
    model: guardHeld('session-model', ruleHere('session-model', undefined, projectData)),
    effort: guardHeld('session-effort', ruleHere('session-effort', undefined, projectData)),
    lead: guardHeld('lead-effort', ruleHere('lead-effort', undefined, projectData)),
    lenses: guardHeld('lens-effort', ruleHere('lens-effort', undefined, projectData)),
    advisor: guardHeld('advisor-model', ruleHere('advisor-model', undefined, projectData)),
    // The senior's model (odd/tasks/senior-orchestrator.md): held only where the project declares it.
    senior: guardHeld('senior-model', ruleHere('senior-model', undefined, projectData)),
    seniorEffort: guardHeld('senior-effort', ruleHere('senior-effort', undefined, projectData)),
  };
}

/** `claudeHeld` as plain values, `{ model, effort, lead, lenses, advisor }`: what each rule holds in the project, or null
 * where the project does not declare it. */
export function heldValues(projectData) {
  const held = claudeHeld(projectData);
  return { model: held.model?.value ?? null, effort: held.effort?.value ?? null, lead: held.lead?.value ?? null, lenses: held.lenses?.value ?? null, advisor: held.advisor?.value ?? null };
}

/** A model as a person reads it: `claude-fable-5-2` is "Fable 5.2", from its family and its version. An id of
 * another shape is given as it is, because a name made up for it would be a guess. */
export function displayName(id) {
  const match = CLAUDE_ID.exec(String(id));
  if (!match) return String(id);
  return `${match[1][0].toUpperCase()}${match[1].slice(1)} ${match[2].replace(/-/g, '.')}`;
}

/** `id` without what a record adds to it: a bracket (`[1m]`) and the date at its end. */
const bare = (id) => String(id).replace(/\[[^\]]*\]$/, '').replace(/-\d{8}$/, '');

/** True when the two are full Claude ids that name one model, a date at the end or a bracket aside. A short name is
 * no id: it names whatever the engine in use gives it (on 2026-11-10 `fable` gave claude-fable-5-1), so it is the
 * same model as nothing, not even as itself. Only Claude ids are compared, since no other has a shape to know a full
 * one by. */
export function sameClaudeModel(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return CLAUDE_ID.test(bare(a)) && bare(a) === bare(b);
}

/** What a session that holds `has` (`{ model, effort }`, either null where its record does not say) has that the
 * home it is held to (`held`, the same shape) does not: `{ model, effort }`, each what the session holds where that
 * differs and null where it does not, or null when nothing differs. A level differs higher as well as lower; what
 * either side does not say is not compared. */
export function offHome(has, held) {
  const known = (value) => typeof value === 'string' && value !== '';
  const model = known(has?.model) && known(held?.model) && !sameClaudeModel(has.model, held.model) ? has.model : null;
  const effort = known(has?.effort) && known(held?.effort) && has.effort !== held.effort ? has.effort : null;
  return model === null && effort === null ? null : { model, effort };
}

/** The line a session gives the user when its own model or effort is not the home's `{ model, effort }`: a session
 * cannot change its own, so he picks them in the menu. In Spanish, the language he reads, and modelled on the line he
 * acted on within two minutes on 2026-11-10. */
export function menuLine({ model, effort }) {
  return `En esta sesión, abre el selector de modelo que está junto a la caja donde escribes y elige ${displayName(model)} con esfuerzo ${MENU_LEVELS[effort] ?? effort}.`;
}
