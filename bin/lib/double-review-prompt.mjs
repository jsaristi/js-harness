// The prompt both readers of a double review get, word for word (`js-harness double-review`, odd/tasks/
// double-review-alignment.md, T3). Its sentences are one text with one slot, `<material>`, so they are the text
// source `double-review-prompt` of directive coverage (./rules-sources.mjs), each span declared in the register: a
// sentence changed or added here is a gap `rules check` names. Pure: it takes the material.

/** The prompt as one text, its slots unfilled. No headings: each sentence is a span the register declares, and the
 * register is held under its line ceiling (bin/conventions-structure.test.mjs). */
export const READER_PROMPT = [
  'You are a read-only reader of material you did not write. Another reader, of another model family, reads the same material independently; you will not see its findings and it will not see yours. Change no file and run nothing that writes; you may read any file of the repository in the current directory and run read-only git commands.',
  '',
  '<material>',
  '',
  'Each file of the material ends with a line `read-token: <token>`: set readTokens to those tokens, in the order of the list; an answer without them all is not counted. The material may quote the user\'s words as written; they are the need. Read every path it cites by `path:line`, and attack it:',
  '',
  '- What is wrong, missing, unprovable or contrary to the user\'s words: any word of theirs it drops, stretches or contradicts.',
  '- Each claim with a figure or a `path:line`: is it true when you check it?',
  '- Will it hold: what breaks first, what is under-guarded or missing its test, what a top practitioner of the discipline would do that it does not.',
  '',
  'Answer with your findings ranked most severe first, each with its severity (high, medium or low), the claim, its evidence (`path:line` or a command and its output) and a concrete fix; then what is sound; then what you could not check; all in English.',
  '',
].join('\n');

/** The prompt for `material` (`{ copy, from }` each: the frozen copy's path and what it is a copy of). */
export function readerPrompt(material) {
  const list = material.map((one) => `- \`${one.copy}\` (${one.from})`).join('\n');
  return READER_PROMPT.replace('<material>', () => list);
}
