// The shape of the values of the two homes of a model and an effort (odd/tasks/one-model-home.md, spec 3): which
// rules are the homes, the lead's level among Claude's, the effort levels a host takes, what a full Claude id looks like, and the faults of a home's
// declaration. It is apart from `model-home.mjs`, which reads the homes, because the rules list reads it to hold a
// home's value to its shape and `model-home.mjs` reads the rules list: one module for both would import in a circle.
// It imports nothing, and every other module takes these names from `model-home.mjs`, which gives them on.

/** The ids of the rules of each home, which `js-harness rules switch` changes together. Claude's is one model and
 * two levels since his decision of 2026-11-11 (odd/tasks/one-model-home.md, S7): `effort` is the level of everything
 * but the lead's session, and `lead` the level of that one. `advisor` is the model of the advisor a session the harness
 * starts consults, his of 2026-11-12 (odd/tasks/advisor-home.md, spec 1); the host gives it no level of its own. */
export const CLAUDE_HOME = Object.freeze({ model: 'session-model', effort: 'session-effort', lead: 'lead-effort', advisor: 'advisor-model' });
export const CODEX_HOME = Object.freeze({ model: 'review-model', effort: 'review-effort' });

/** The effort levels a host takes, lowest first: the order that says one level is above another. */
export const EFFORTS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);

/** A full Claude id, `claude-<family>-<version>` with a date at its end or none: its family and its version. */
export const CLAUDE_ID = /^claude-([a-z]+)-(\d+(?:-\d{1,2})*)(?:-\d{8})?$/;

/** The faults of shape of the declaration `rule` when it is one of a home and holds a text or a number, for
 * `readRules`; none for any other rule, nor for an empty or missing value, which has its own fault there. The Claude
 * model is a full id, since a short name is whatever the engine in use gives it (on 2026-11-10 `fable` gave
 * claude-fable-5-1 while the rule read 5.2). An effort is one of `EFFORTS`. Codex's id has no shape to hold it to,
 * so only what cannot be one is refused, and the probe of `rules switch` is its check. A number is never one: it
 * would be handed to a launch as it is. */
export function homeFaults(rule) {
  const { id, value } = rule;
  const text = typeof value === 'string';
  if (value === '' || !(text || typeof value === 'number')) return [];
  if ((id === CLAUDE_HOME.model || id === CLAUDE_HOME.advisor) && !(text && CLAUDE_ID.test(value))) {
    return ['the value is not a full Claude id, claude-<family>-<version>: a short name gives whatever model the engine in use has for it'];
  }
  if ((id === CLAUDE_HOME.effort || id === CLAUDE_HOME.lead || id === CODEX_HOME.effort) && !EFFORTS.includes(value)) {
    return [`the value is not an effort level: ${EFFORTS.slice(0, -1).join(', ')} or ${EFFORTS.at(-1)}`];
  }
  if (id === CODEX_HOME.model && (!text || /\s/.test(value) || /^claude\b/i.test(value) || EFFORTS.includes(value))) {
    return ['the value is not the id of a Codex model: it is no text, holds a space, is a Claude id or is an effort level'];
  }
  return [];
}
