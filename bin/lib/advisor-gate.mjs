// The sentences the advisor gate (bin/advisor-gate.mjs) sends an agent, kept apart from the command so the coverage
// (bin/lib/rules-sources.mjs) can cut them into spans without a module of bin/lib importing a command, as the template
// gate's sentences live in ./template-gate.mjs (odd/tasks/advisor-use.md, P1).

/** Every sentence the gate sends, a `<name>` slot for what each call fills: a sentence is added here, never built in
 * place. */
export const ADVISOR_SAYS = Object.freeze({
  missed: 'js-harness advisor-gate: this <act> came with no advisor call in its stretch (since his last message or the last session event, within <calls> tool calls).',
  how: 'Before the acts that decide, call the advisor alone, in a response of its own, read its answer, then act.',
  week: 'This is the warning week (odd/tasks/advisor-use.md, P3): the act goes through, and the decision is recorded.',
});

/** The sentences of `ADVISOR_SAYS` as one text, a paragraph each, as the coverage cuts it. */
export const ADVISOR_MESSAGES = `${Object.values(ADVISOR_SAYS).join('\n\n')}\n`;

/** The sentence `key` of `ADVISOR_SAYS` with each `<name>` slot filled from `values`; a slot with no value stays. */
export const advisorSay = (key, values = {}) => ADVISOR_SAYS[key].replace(/<(\w+)>/g, (slot, name) => (Object.hasOwn(values, name) ? String(values[name]) : slot));
