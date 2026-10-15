// The scan of the texts in force for a restated value (odd/tasks/rule-hierarchy.md, "The row `rules` (T16d)"): a
// line that a rule's pattern matches says the rule's value by its subject, where the cure is the `rule:<id>` mark
// instead of the value. The texts that show a value, or quote what was said, are not texts in force.
import { fenceWalk } from './rules-check.mjs';
import { patternOf } from './rules.mjs';

// The homes of the list, which show a value, and the texts that quote what was said or are frozen.
const NOT_IN_FORCE = new Set(['bin/lib/rules-data.mjs', 'docs/rule-sources.json', 'docs/RULES.md', 'docs/FAILURES.md', 'docs/origin.md']);
// Where the history of a feature document starts: what was said and done there is not in force.
const HISTORY_LINE = /^## (?:Progress|Log)\r?$/;
const FEATURE_DOCUMENT = /^odd\/tasks\/[^/]+\.md$/;

/** The lines of `text`, at `path`, that are in force: `{ path, line, text }`, `line` from 1. A blank line and a line
 * inside a fence are left out, and so is a feature document from its first `## Progress` or `## Log` line on; a home
 * of the list or a quoting text gives none. */
export function inForceLines(path, text) {
  if (NOT_IN_FORCE.has(path)) return [];
  const history = FEATURE_DOCUMENT.test(path);
  const lines = [];
  let number = 0;
  for (const { line, outside } of fenceWalk(text).walked) {
    number += 1;
    if (history && outside && HISTORY_LINE.test(line)) break;
    if (outside && line.trim() !== '') lines.push({ path, line: number, text: line.replace(/\r$/, '') });
  }
  return lines;
}

/** The rules in force that carry patterns, each with its regular expressions. */
function scanned(rules) {
  return rules.filter((rule) => !Object.hasOwn(rule, 'retired') && Array.isArray(rule.patterns)).map((rule) => ({ id: rule.id, patterns: rule.patterns.map(patternOf) }));
}

/** The findings in `lines`: `{ id, path, line, text }` for each line a pattern of a rule in force matches, once per
 * rule. A `rule:<id>` mark beside the value does not excuse it. */
export function scanLines(rules, lines) {
  const findings = [];
  const each = scanned(rules);
  for (const line of lines) {
    for (const rule of each) {
      if (rule.patterns.some((pattern) => pattern.test(line.text))) findings.push({ id: rule.id, path: line.path, line: line.line, text: line.text });
    }
  }
  return findings;
}

/** How many findings each rule in force with patterns has in `files` (`{ path, text }`), and the ids of the rules in
 * force with none, which are not scanned: `{ counts, unscanned }`. */
export function countFindings(rules, files) {
  const counts = Object.fromEntries(scanned(rules).map((rule) => [rule.id, 0]));
  for (const { path, text } of files) {
    for (const finding of scanLines(rules, inForceLines(path, text))) counts[finding.id] += 1;
  }
  const unscanned = rules.filter((rule) => !Object.hasOwn(rule, 'retired') && !Array.isArray(rule.patterns)).map((rule) => rule.id);
  return { counts, unscanned };
}
